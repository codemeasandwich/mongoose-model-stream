'use strict';

const mongooseO = require('mongoose');
      mongooseO.Promise = global.Promise;
      
const Schema = mongooseO.Schema;
const dbO = mongooseO.connect('mongodb://localhost/testmongoosestream');

const modulePlus = require('./..');

// ############################### Test with timestamps
// ####################################################

//=============================================== Logic
const ASchema = new Schema({  text: String }, { timestamps: true });

//=========================================== generator
const AModule = modulePlus('A', ASchema);

//===================================== start listening
AModule.stream$.subscribe(console.log, console.error, console.info);

//======================================= start example
setTimeout(function () {

//+++++++++++++++++++++++++++++++++++++++++++++ create
  AModule.create({ text: "foo_A" })
  .then(function (chatMessage) {

    console.log(" >> FROM ", 'text = "' + chatMessage.text + '"');
    chatMessage.text = "bar_A";
    console.log(" >> TO ", 'text = "' + chatMessage.text + '"');

//+++++++++++++++++++++++++++++++++++++++++++++ update
    return chatMessage.save();
  }).then(function (chatMessage) {

    setTimeout(function () {

      console.log(" >>> FROM ", 'text = "' + chatMessage.text + '"');
      chatMessage.text = "baz_A";
      console.log(" >>> TO ", 'text = "' + chatMessage.text + '"');

//+++++++++++++++++++++++++++++++++++++++++++++ update

      chatMessage.save();
    }, 1000);
  });
}, 1000);




// ########################### Test with-out timestamps
// ####################################################

//=============================================== Logic
const BSchema = new Schema({ text: String });

//=========================================== generator
const BModule = modulePlus('B', BSchema);

//===================================== start listening

const BTest = ['create','update','update'];
let Bcount = 0;
BModule.stream$.subscribe(function(doc){
  
  console.log(Bcount+"B "+BTest[Bcount]+" "+doc.text+doc, BTest[Bcount] == doc);
  Bcount++;
  }, console.error, console.info);

//======================================= start example
setTimeout(function () {

//+++++++++++++++++++++++++++++++++++++++++++++ create
  BModule.create({ text: "foo_B" })
  .then(function (chatMessage) {

    console.log(" >> FROM ", 'text = "' + chatMessage.text + '"');
    chatMessage.text = "bar_B";
    console.log(" >> TO ", 'text = "' + chatMessage.text + '"');

//+++++++++++++++++++++++++++++++++++++++++++++ update
    return chatMessage.save();
  }).then(function (chatMessage) {

    setTimeout(function () {

      console.log(" >>> FROM ", 'text = "' + chatMessage.text + '"');
      chatMessage.text = "baz_B";
      console.log(" >>> TO ", 'text = "' + chatMessage.text + '"');

//+++++++++++++++++++++++++++++++++++++++++++++ update

      chatMessage.save();
    }, 1000);
  });
}, 1000);


// ###################################### Test removing
// ####################################################

//=============================================== Logic
const CSchema = new Schema({ text: String });

//=========================================== generator
const CModule = modulePlus('C', CSchema);

//===================================== start listening

const CTest = ['create','remove'];
let Ccount = 0;
CModule.stream$.subscribe(function(doc){
  console.log(Ccount+" C >> "+CTest[Ccount]+" >> "+doc.text+ ' ++++ ' +doc, CTest[Ccount] == doc);
  Ccount++;
}, console.error, console.info);

//======================================= start example
setTimeout(function () {

//+++++++++++++++++++++++++++++++++++++++++++++ create
  CModule.create({ text: "foo_C" })
  
  .then(function (chatMessage) {
//+++++++++++++++++++++++++++++++++++++++++++++ remove
    return chatMessage.remove();
  }).catch(console.error)
}, 1000);












