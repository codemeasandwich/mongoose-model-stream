"use strict";

var Subject = require('rx').Subject;

var mongoose = require('mongoose');

module.exports = function modulePlus(modelNameS, schema, enableDownStream = true) {

  const streamEnum = Object.freeze({create:'create', update:'update', remove:'remove', restore:'restore'});
  const streamAttributes = {
    action: {
      type: String,
      enum: Object.keys( streamEnum ).map( propName => streamEnum[propName] )
    },
    Data: Object
  };
  const streamOptions = { timestamps: true, capped: 1024 };
  const streamSchema = new mongoose.Schema(streamAttributes, streamOptions);

  const streamDB = mongoose.model('!' + modelNameS, streamSchema);

  schema.pre('save', function(next, aF) {
    // this = data
    
    var actionS = streamEnum.update;
    if (this.deletedAt) {
      actionS = streamEnum.remove;
    } else if (null === this.deletedAt) {
      actionS = streamEnum.restore;
      this.deletedAt = undefined;
    } else if (this.isNew) {
      actionS = streamEnum.create;
    }

    streamDB.create({ action: actionS, Data: this })
    .catch(function(err){
      throw err;
    });

    next();
  });

  
//+++++++++++++++++++++++++++++++++++++++++++++ REMOVE
//++++++++++++++++++++++++++++++++++++++++++++++++++++

    schema.pre('remove', function preRemove(next,reject) {

      streamDB.create({ action: 'remove', Data: this});

      next();
      
    });
   // process.stdout.write(  process.title  );
  const modelDB = mongoose.model(modelNameS, schema);

  if (enableDownStream) {
    modelDB.stream$ = new Subject();

    streamDB.count().then((count) => {
      if (0 === count) {
        return streamDB.create({});
      }
      return true;
    }).then( () => {

      const Stream = streamDB.find({ createdAt: { $gt: new Date() } }).tailable({ "awaitdata": true }).cursor();
      Stream.on('data', (doc) => {
      
        function Fn(_data){
          
          for(let propName in _data){
            this[propName] = _data[propName];
          }
        }
       
       Fn.prototype.id = doc.Data.id || doc.Data._id;
       
        Fn.prototype.valueOf = function () {
          return doc.action;
        };
        Fn.prototype.toString = function () {
          return doc.action;
        };
        
        modelDB.stream$.onNext(new Fn(doc.Data));
      });
      Stream.on('error', doc => modelDB.stream$.onError(doc) );
      Stream.on('close', ( ) => modelDB.stream$.onCompleted() );
    }).catch((err) => {
      throw err;
    });
  }

  return modelDB;
};
