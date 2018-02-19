"use strict";

//https://tools.ietf.org/html/rfc6902
//https://www.npmjs.com/package/rfc6902

const rfc6902 = require('rfc6902');
const Subject = require('rx').Subject;
const mongoose = require('mongoose');

//++++++++++++++++++++++++++++++++++++++++++++++ Setup
//++++++++++++++++++++++++++++++++++++++++++++++++++++

const patch = new mongoose.Schema({
    op: { type: String, required: true },
    path: { type: String, required: true },
    from:String, value:mongoose.Schema.Types.Mixed
  },{ _id : false });
const streamSchema = new mongoose.Schema({ patchs: [patch],  target:mongoose.Schema.Types.ObjectId, createdAt:Date },
                                         { capped: 1024, minimize: false  });

//=====================================================
// ========================================= modulePlus
//=====================================================

module.exports = function modulePlus(modelNameS, schema, enableDownStream = true) {

  const streamDB = mongoose.model('!' + modelNameS, streamSchema);

//+++++++++++++++++++++++++++++++++++++++++++++++ SAVE
//++++++++++++++++++++++++++++++++++++++++++++++++++++

  schema.pre('save', function() {

    modelDB.findById(this._id)
    .then(oldDoc => [
      !!oldDoc,
      // https://github.com/chbrown/rfc6902/issues/15
      oldDoc ? JSON.parse(JSON.stringify(oldDoc)) : {},
      JSON.parse(JSON.stringify(this))])
    .then(([exists,oldDoc,newDoc]) => {

      let patchs = {}

      if(!exists){
        patchs = [{ op: "add", path: "/", value: newDoc.toJSON() },...patchs]
      }// if we have a updatedAt time. Use it as a check
      else {
        patchs = rfc6902.createPatch(oldDoc,newDoc)
      }

      if(oldDoc.updatedAt){ // TODO: add schema.pre('validate', ...) to reject save if patchs.length is ZERO
        patchs = [{ op: "test", path: "/updatedAt", value: oldDoc.updatedAt },...patchs]
      }

      streamDB.create({patchs,target:newDoc._id, createdAt:new Date})
    })
    .catch((err)=>{ throw err });

  });// END schema pre 'save'

//+++++++++++++++++++++++++++++++++++++++++++++ REMOVE
//++++++++++++++++++++++++++++++++++++++++++++++++++++

    schema.pre('remove', function preRemove(next,reject) {

      streamDB.create({
        patchs:[{op: "remove", path: "/"}],
        target:this._id
      });

      next();

    });// END schema pre 'remove'

//+++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++

  const modelDB = mongoose.model(modelNameS, schema);

  if (enableDownStream) {
    modelDB.stream = new Subject();

    streamDB.count().then((count) => {
      if (0 === count) {
        return streamDB.create({});
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

  return modelDB;
}; // function modulePlus
