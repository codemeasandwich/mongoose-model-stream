"use strict";

//https://tools.ietf.org/html/rfc6902
//https://www.npmjs.com/package/rfc6902

const rfc6902 = require('rfc6902');
const Subject = require('rx').Subject;
const mongoose = require('mongoose');

//++++++++++++++++++++++++++++++++++++++++++++++ Setup
//++++++++++++++++++++++++++++++++++++++++++++++++++++

function checkVal(val) {
    if ("object" === typeof val
    && mongoose.Types.ObjectId.isValid(val)) {
      return val+""
    }
    if ("[object Object]" === Object.prototype.toString.call(val)
           || Array.isArray(val)) {
      return scrubObjIdRefs(val)
    }
    return val
}

function scrubObjIdRefs(data) {
    // We use toString.call, so we dont catch Dates
  if ("[object Object]" === Object.prototype.toString.call(data)) {
    const newObj = {}
    for (const key in data) {
        newObj[key] = checkVal(data[key])
    }
    return newObj
  } else if (Array.isArray(data)){
    return data.map(checkVal)
  }
  return data
}

const patch = new mongoose.Schema({
    op: { type: String, required: true },
    path: { type: String, required: true },
    from:String, value:mongoose.Schema.Types.Mixed
  },{ _id : false });

//=====================================================
//======================================== moduleStream
//=====================================================

const streamSchemaBluePrint = { patchs: { type:[patch], required: true },
                                target: mongoose.Schema.Types.ObjectId,
                                saveBy: mongoose.Schema.Types.ObjectId,
				action:{ type: String, enum:["CREATE","UPDATE","DELETE"], default: "UPDATE" },
                                createdAt:{ type: Date, default: Date.now } }

module.exports = mongoose.moduleStream = function moduleStream(modelNameS, schema, enableDownStream = true) {
  let totle = 0
  const hasUpdatedAt = !!(schema.paths.updatedAt)

  let streamSchemaOptions = { capped: 4096, minimize: false ,versionKey: false  }

  if("object" === typeof enableDownStream){
    streamSchemaOptions = Object.assign(streamSchemaOptions,enableDownStream)
    enableDownStream = streamSchemaOptions.enableDownStream !== false;
  }

  const streamSchema = new mongoose.Schema(streamSchemaBluePrint,streamSchemaOptions);


  const streamDB = mongoose.model('__' + modelNameS, streamSchema);

//+++++++++++++++++++++++++++++++++++++++++++++ UPDATE
//++ docs.mongodb.com/manual/reference/operator/update

let lastUpdatedList = {}

function preUpdate(next) {
    
    modelDB.find(this._conditions)
           .sort({'_id': -1})
           .then(list => {
                lastUpdatedList = list;
                next()
           })
           /* }).catch(logger.error)
           .then(()=>next())*/
  }

function postUpdate(doc,next) {

    modelDB.find({'_id': { $in: lastUpdatedList.map(({_id})=>_id) }})
           .sort({'_id': -1})
           .then(list =>{

      list.forEach((item,index)=>{

        const oldVal = lastUpdatedList[index],
              newVal = item

        let patchs =  rfc6902.createPatch(scrubObjIdRefs(oldVal.toObject()),scrubObjIdRefs(newVal.toObject()))
        if(0 < patchs.length){
          if(newVal.updatedAt){
            patchs = [{ op: "test", path: "/updatedAt", value: oldVal.updatedAt },...patchs]
          }
          
        const record = { patchs,
                 target:item._id,
                 saveBy: savedBy ? "string" === typeof savedBy ? savedBy
                                                               : savedBy(oldVal,newVal,patchs)
                                 : undefined  }
                                           
          streamDB.create(record)
        }
      })
      savedBy = undefined
      lastUpdatedList = {} // reset
      next()
    }).catch(err=>{
            throw err
           // logger.error(err)
           // next()
            })
  }
  
  schema.pre(/^update/, preUpdate);
  schema.pre(/Update$/, preUpdate);

  schema.post(/^update/, postUpdate);
  schema.post(/Update$/, postUpdate);
//+++++++++++++++++++++++++++++++++++++++++++++++ SAVE
//++++++++++++++++++++++++++++++++++++++++++++++++++++

  schema.pre('save', function(next) {
    totle++ // because you can have a race condition with inserting the first doc(for the cuser) after a user change as been saved
    modelDB.findById(this._id)
    .then(oldDoc => [
      !oldDoc,
      // https://github.com/chbrown/rfc6902/issues/15
      oldDoc || {},
      this])
    .then(([toCreate,oldDoc,newDoc]) => {

      const indexOfChange = changers.findIndex(({item})=> item === this)
      let whoMadeTheChange;

      if(0 <= indexOfChange){
        whoMadeTheChange = changers[indexOfChange].id
        changers = changers.filter((changer,index) => indexOfChange != index)
      }

      let patchs = []


      if(0 === patchs.length){
        next();
        return
      }

      if(oldDoc.updatedAt){ // TODO: add schema.pre('validate', ...) to reject save if patchs.length is ZERO
        patchs = [{ op: "test", path: "/updatedAt", value: oldDoc.updatedAt },...patchs]
      }

      const logToSave = {patchs,target:newDoc._id,action:toCreate?"CREATE":"UPDATE"}

      if(whoMadeTheChange){
        logToSave.saveBy = whoMadeTheChange
      }

      next();
      streamDB.create(logToSave)
    })
    .catch((err)=>{
        next();
        throw err
    });

  });// END schema pre 'save'

//+++++++++++++++++++++++++++++++++++++++++++++ REMOVE
//++++++++++++++++++++++++++++++++++++++++++++++++++++

    schema.pre('remove', function preRemove(next,reject) {

      streamDB.create({
        patchs:[{op: "remove", path: "/"}],
        target:this._id,
        action:"DELETE"
      }).catch(err=>reject(err));

      next();

    });// END schema pre 'remove'

//+++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++

let changers = []

    schema.methods.saveBy = function(next) {
        if("function" === typeof next || ! next){
          return this.save(next)
        }
        const id = next._id || next
        changers.push({
          id, item:this
        })
        return this.save()
    };




  const modelDB = mongoose.model(modelNameS, schema);

  if (enableDownStream) {
    modelDB.stream = new Subject();

    streamDB.count().then((count) => {
      if (0 === count && 0 === totle) {
        // you need at least ONE doc to start the cursor
        return streamDB.create({ patchs:[], target:null });
      }
      return true;
    }).then( () => {

      const Stream = streamDB.find({ createdAt: { $gt: new Date() } })
                             .tailable({ "awaitdata": true })
                             .cursor();

      Stream.on('data', (change) => modelDB.stream.onNext(change));
      Stream.on('error',( doc    ) => modelDB.stream.onError(doc));
      Stream.on('close',(        ) => modelDB.stream.onCompleted());
    }).catch((err) => {
      throw err;
    });
  } // END enableDownStream

  // TODO add ".saveBy(..user..)" to attach who made the change on the 'change stream'

  const wrappers = {}
   let  savedBy
  
  ["update","updateMany", "updateOne", "findOneAndUpdate", "findByIdAndUpdate"].forEach( fnName => {
     
    const ogFn = modelDB[fnName];
    
    wrappers[fnName] = function(conditions,update,options){
        
        if (options && options.savedBy) {
          savedBy = options.savedBy
        }
        return ogFn.call(modelDB,conditions,update,options)
    } // END of wrapper
  })
  
  
  return Object.assign(modelDB, wrappers);
}; // function moduleStream
