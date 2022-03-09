"use strict";

//https://tools.ietf.org/html/rfc6902
//https://www.npmjs.com/package/rfc6902

const rfc6902 = require('rfc6902');
const Subject = require('rx').Subject;
const mongoose = require('mongoose');

//=====================================================
// ============================================ helpers
//=====================================================

//+++++++++++++++++++++++++++++++++++++++++++ checkVal
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
} // END checkVal

//+++++++++++++++++++++++++++++++++++++ scrubObjIdRefs
//++++++++++++++++++++++++++++++++++++++++++++++++++++

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
} // END scrubObjIdRefs

//=====================================================
// ============================================= Schema
//=====================================================

//++++++++++++++++++++++++++++++++++++++++++++++ patch
//++++++++++++++++++++++++++++++++++++++++++++++++++++

const patch = new mongoose.Schema({
    op: { type: String, required: true },
    path: { type: String, required: true },
    from:String, value:mongoose.Schema.Types.Mixed
  },{ _id : false });

//++++++++++++++++++++++++++++++++++++++++ change meta
//++++++++++++++++++++++++++++++++++++++++++++++++++++

const streamSchemaBluePrint = { patchs: { type:[patch], required: true },
                                target: mongoose.Schema.Types.ObjectId,
                                tag: String,
                                saveBy: mongoose.Schema.Types.ObjectId,
				action:{ type: String, enum:["CREATE","UPDATE","DELETE"], default: "UPDATE" },
                                createdAt:{ type: Date, default: Date.now } }

//=====================================================
//================================ setup Chage Document
//=====================================================

function setupChageDocument(modelNameS, hasUpdatedAt, enableDownStream) {
  
  let streamSchemaOptions = { capped: 4096, minimize: false, versionKey: false  }
  
  if("object" === typeof enableDownStream){
    streamSchemaOptions = Object.assign(streamSchemaOptions,enableDownStream)
    enableDownStream = streamSchemaOptions.enableDownStream !== false;
  }
  
  const streamSchema = new mongoose.Schema(streamSchemaBluePrint,streamSchemaOptions);

  return mongoose.model('__' + modelNameS, streamSchema);
} // END setupChageDocument

//=====================================================
//=================================== get Get Change Fn
//=====================================================

function getGetChangeFn(change){
  return () => {
    const patchs = change.patchs.filter(({op})=>op !== 'test')
                                .map(change=>{
                                    if (change.op === 'remove') {
                                        return { op:'add', value:undefined, path:change.path }
                                    } else if (change.op === 'replace') {
                                        return { op:'add', value:change.value, path:change.path }
                                    }
                                    return change
                                }) // END map
    
    if (patchs.length) {
      const result = {}
      rfc6902.applyPatch(result, patchs)
      return result
    } else {
      return {}
    } // END else
  }// END getChange
} // END getGetChangeFn

//=====================================================
//================================= create a path entry
//=====================================================

function wireUpStream(modelDB,streamDB){

  const Stream = streamDB.find({ createdAt: { $gt: new Date() } })
                         .tailable({ "awaitdata": true })
                         .cursor();

  Stream.on('data', (change) => {
  /*  if (change.tag) {
        console.log("++|++ ",change.tag)
        return;
    }*/
    
   
    change.getChange = getGetChangeFn(change)
    change.getTarget = () => modelDB.findById(change.target)
    
    const toObject = change.toObject.bind(change)
    change.toObject = ()=> {
        const obj = toObject()
        obj.getChange = change.getChange
        obj.getTarget = change.getTarget
        return obj
    } // END toObject

    modelDB.stream.onNext(change)
  }); // END Stream.on 'data'
  Stream.on('error',( doc ) => modelDB.stream.onError(doc));
  Stream.on('close',(     ) => modelDB.stream.onCompleted());
} // END wireUpStream

//=====================================================
//================================= create a path entry
//=====================================================

function logChange(args) {
    //code
}

//=====================================================
//======================================== moduleStream
//=====================================================

module.exports = mongoose.moduleStream = function moduleStream(modelNameS, schema, enableDownStream = true) {
  let totle = 0
  
  const streamDB = setupChageDocument(modelNameS, schema.paths.updatedAt, enableDownStream)
  
  
//+ Fix: there is bug with Mongoose saves out of order
//++++++++++++++++++++++++++++++++++++++++++++++++++++ 
  
  let lastRecord = Promise.resolve()
  function streamDBcreate(record) {
    return lastRecord = lastRecord.then(()=>streamDB.create(record))
  } // END streamDBcreate
  
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
} //END preUpdate

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
                                 : undefined,
                   tag :    tag  ? "string" === typeof tag     ? tag
                                                               : tag(oldVal,newVal,patchs)
                                 : undefined  }
          
          streamDBcreate(record)
        }
      }) // END list.forEach
      savedBy = undefined
      tag = undefined
      lastUpdatedList = {} // reset
      next()
    }).catch(err=>{
        throw err
       // logger.error(err)
       // next()
    })
  } // END postUpdate
  
  schema.pre(/^update/, preUpdate);
  schema.pre(/Update$/, preUpdate);

  schema.post(/^update/, postUpdate);
  schema.post(/Update$/, postUpdate);
  //schema.post(/^create$/, postUpdate);
//+++++++++++++++++++++++++++++++++++++++++++++++ SAVE
//++++++++++++++++++++++++++++++++++++++++++++++++++++

  schema.pre('save', function(next,opts) {
    
    // save("tag") is passed as {"0":"t","1":"a","2":"g"}
    if ("object" === typeof opts) {
        const keys = Object.keys(opts)
        if (keys.every((key,index) => index === ~~key
                                   && "string" === typeof opts[key]
                                   && 1 === opts[key].length)) {
            opts = {tag:keys.map(key => opts[key]).join("")}
        }
    }
    
    totle++ // because you can have a race condition with inserting the first doc(for the cuser) after a user change as been saved
    modelDB.findById(this._id)
    .then(oldDoc => [
      !oldDoc,
      // https://github.com/chbrown/rfc6902/issues/15
      oldDoc || {},
      this])
    .then(([toCreate,oldDoc,newDoc]) => {
      let patchs = []

    //  if(isFirst){
    //    patchs = rfc6902.createPatch({},scrubObjIdRefs(newDoc.toObject()))//[{ op: "add", path: "/", value: newDoc }]
     // }// if we have a updatedAt time. Use it as a check
     // else {
        patchs = rfc6902.createPatch(toCreate ? {}
                                              : scrubObjIdRefs(oldDoc.toObject()),
                                     scrubObjIdRefs(newDoc.toObject()))
    //  }

      if(0 === patchs.length){
        next();
        return
      }

      if(oldDoc.updatedAt){ // TODO: add schema.pre('validate', ...) to reject save if patchs.length is ZERO
        patchs = [{ op: "test", path: "/updatedAt", value: oldDoc.updatedAt },...patchs]
      }

      const logToSave = {
        patchs,
        target : newDoc._id,
        action : toCreate ? "CREATE"
                          : "UPDATE"
      } // END logToSave

      
      
      const changeArray = changers[this._id]
    
      //const indexOfChange = changers.findIndex(({item})=> item === this)
      let whoMadeTheChange, tagThisChange;

      if(changeArray && changeArray.length){
        const change = changeArray.shift()
        whoMadeTheChange = change.id
        tagThisChange = change.tag
      }
      
      if (opts && opts.saveBy) {
        logToSave.saveBy = opts.saveBy
      } else if(whoMadeTheChange){
        logToSave.saveBy = whoMadeTheChange
      }
      if (opts && opts.tag) {
        logToSave.tag = opts.tag
      } else if (tagThisChange) {
        logToSave.tag = tagThisChange
      } 
      
      streamDBcreate(logToSave)
      next();
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

    let changers = {}

    schema.methods.saveBy = function(next,tag) {
        
        if("function" === typeof next || ! next){
          return this.save(next)
        }
        const user = next._id || next
        const targetId = this._id+""
        if ( ! changers[targetId]) {
            changers[targetId] = []
        }
        changers[targetId].push({ id:user, item:this, tag })
        return this.save()
    }; // END saveBy
/*
    const schemaMethodsSave = schema.methods.save.bind(schema.methods)
    
    schema.methods.save = function(next) {
        
        const targetId = this._id+""
        if ( ! changers[targetId]) {
            changers[targetId] = []
        }
        
        if("string" === typeof next){
          changers[targetId].push({ item:this, tag:next })
        }
        
        return this.save(next)
    }; // END saveBy
*/
  const modelDB = mongoose.model(modelNameS, schema);

  if (enableDownStream) {
    modelDB.stream = new Subject();

    streamDB.countDocuments().then((count) => {
        
      if (0 === count && 0 === totle) {
        // you need at least ONE doc to start the cursor
        return streamDB.create({ patchs:[]//, target:"mongoose-model-stream!"
                               });
      }
      return true;
    }).then(()=>wireUpStream(modelDB,streamDB))
    .catch((err) => {
      throw err;
    });
  } // END enableDownStream

  // TODO add ".saveBy(..user..)" to attach who made the change on the 'change stream'

  const wrappers = {}
  let  savedBy, tag;
  
  ["update", "updateMany", "updateOne", "findOneAndUpdate", "findByIdAndUpdate"].forEach( fnName => {
    
    const ogFn = modelDB[fnName];
    
    wrappers[fnName] = function(conditions,update,options){
        
        if (options){
            if(options.savedBy) {
              savedBy = options.savedBy
            }
            if(options.tag) {
              tag = options.tag
            }
        } // END if
        return ogFn.call(modelDB,conditions,update,options)
    } // END of wrapper
  }) // END foreach
  
  const modelDBCreate = modelDB.create.bind(modelDB)
  
  wrappers.create = function(newDocVals, options){
    
    /*if ("object"=== typeof options){
      if(options.savedBy) {
        savedBy = options.savedBy
      }
      if(options.tag) {
        tag = options.tag
      }
    }else */if ("string"=== typeof options){
        options = { tag : options }
    } // END if
    return modelDBCreate([newDocVals],options).then(doc => doc[0])
  }
  
  return Object.assign(modelDB, wrappers);
}; // function moduleStream
