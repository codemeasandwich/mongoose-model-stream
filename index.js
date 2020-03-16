"use strict";

//https://tools.ietf.org/html/rfc6902
//https://www.npmjs.com/package/rfc6902

const rfc6902 = require('rfc6902');
const Subject = require('rx').Subject;
const mongoose = require('mongoose');
let totle = 0
//++++++++++++++++++++++++++++++++++++++++++++++ Setup
//++++++++++++++++++++++++++++++++++++++++++++++++++++

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
                                createdAt:{ type: Date, default: Date.now } }

module.exports = mongoose.moduleStream = function moduleStream(modelNameS, schema, enableDownStream = true) {

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

let lastUpdatedList = []

  schema.pre('update', function() {
    modelDB.find().sort({'_id': -1}).then(list => lastUpdatedList = list)
  });

  schema.post('update', function() {

    modelDB.find().sort({'_id': -1}).then(list =>{

      list.forEach((item,index)=>{

        const oldVal = lastUpdatedList[index],
              newVal = item

        let patchs =  rfc6902.createPatch(oldVal.toObject(),newVal.toObject())
        if(0 < patchs.length){
          if(newVal.updatedAt){
            patchs = [{ op: "test", path: "/updatedAt", value: oldVal.updatedAt },...patchs]
          }
          streamDB.create({patchs,target:item._id})
        }

      })
      lastUpdatedList = [] // reset
    })
  });
//+++++++++++++++++++++++++++++++++++++++++++++++ SAVE
//++++++++++++++++++++++++++++++++++++++++++++++++++++

  schema.pre('save', function(next) {
    totle++ // because you can have a race condition with inserting the first doc(for the cuser) after a user change as been saved
    modelDB.findById(this._id)
    .then(oldDoc => [
      !!oldDoc,
      // https://github.com/chbrown/rfc6902/issues/15
      oldDoc || {},
      this])
    .then(([exists,oldDoc,newDoc]) => {

      const indexOfChange = changers.findIndex(({item})=> item === this)
      let whoMadeTheChange;

      if(0 <= indexOfChange){
        whoMadeTheChange = changers[indexOfChange].id
        changers = changers.filter((changer,index) => indexOfChange != index)
      }

      let patchs = []

      if(!exists){
        patchs = [{ op: "add", path: "/", value: newDoc }]
      }// if we have a updatedAt time. Use it as a check
      else {
        patchs = rfc6902.createPatch(oldDoc.toObject(),newDoc.toObject())
      }

      if(0 === patchs.length){
        next();
        return
      }

      if(oldDoc.updatedAt){ // TODO: add schema.pre('validate', ...) to reject save if patchs.length is ZERO
        patchs = [{ op: "test", path: "/updatedAt", value: oldDoc.updatedAt },...patchs]
      }

      const logToSave = {patchs,target:newDoc._id}

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
        target:this._id
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

  return modelDB;
}; // function moduleStream
