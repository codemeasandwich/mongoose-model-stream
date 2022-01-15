"use strict";
const assert = require('chai').assert;
const expect = require('chai').expect;
const faker = require('Faker');
const mongoose = require('mongoose');
const rfc6902 = require('rfc6902');

const Schema = mongoose.Schema;
															mongoose.connect('mongodb://localhost/testmongoosestream');

const modulePlus = require('./index.js');

//=====================================================
// ============================================ helpers
//=====================================================

function genRandomId() {
  return (new Date).getTime().toString(32).toUpperCase();
}

//=====================================================
// ============================================== tests
//=====================================================

describe("mongoose model stream", function() { //log the function
		
//=====================================================
  it('should work with module using auto timestamps', function(done){
//=====================================================

//=========================================== generator
    const Module = modulePlus('TEST'+genRandomId(), 
                               new Schema({  text: String }, { timestamps: true }));

//===================================== expected events

    const Test   = ['create','update','update'];
    const Values = Test.map( () => faker.Name.findName() );
    let CountOfTestIndex = 0;
    let outputVal = { };

//===================================== start listening
    Module.stream.subscribe(
      function Data(doc){
	rfc6902.applyPatch(outputVal,doc.toObject().patchs)
        assert.equal(outputVal.text, Values[CountOfTestIndex],"Checking the core value");
        assert.equal(doc.target+"", outputVal._id+"","Checking the id value");
        assert.equal(doc.action, 0 === CountOfTestIndex ? "CREATE":"UPDATE","Should be the first event");
        assert.equal(Object.prototype.toString.call(doc.createdAt), "[object Date]","Should have createdAt");
						
	if(++CountOfTestIndex === Test.length){
	  Module.stream.onCompleted();
	}
      }, function Fail(err){
	done(err);
      }, function Done(){
	done();
    }); // END subscribe

//======================================= start example
    setTimeout(function () {
//+++++++++++++++++++++++++++++++++++++++++++++ create
      Module.create({ text: Values[0] })
        .then(function (chatMessage) {
          
          chatMessage.text = Values[1];
//+++++++++++++++++++++++++++++++++++++++++++++ update
          return chatMessage.save();
        }).then(function (chatMessage) {
          chatMessage.text = Values[2];
//+++++++++++++++++++++++++++++++++++++++++++++ updatd
          chatMessage.save();
        }) // END then
	.catch(function errorHandler(){
	  assert.doesNotThrow(fn, Error, 'function does not throw');
	}); // END catch
     }, 150); // END setTimeout
   }); // END it should work with module using auto timestamps

	
//=====================================================
  it('should with out auto timestamps', function(done){
//=====================================================

//=========================================== generator
    const Module = modulePlus('TEST'+genRandomId(), new Schema({ text: String }));

//===================================== expected events

    const Test   = ['create','update','update'];
    const Values = Test.map( () => faker.Name.findName() );
    let CountOfTestIndex = 0;
    let outputVal = { };

//===================================== start listening
    Module.stream.subscribe(
      function Data(doc){
	rfc6902.applyPatch(outputVal,doc.toObject().patchs)
        assert.equal(outputVal.text, Values[CountOfTestIndex],"Checking the core value");
        assert.equal(doc.target+"", outputVal._id+"","Checking the id value");
        assert.equal(doc.action, 0 === CountOfTestIndex ? "CREATE":"UPDATE","Should be the first event");
        assert.equal(Object.prototype.toString.call(doc.createdAt), "[object Date]","Should have createdAt");
						
        if(++CountOfTestIndex === Test.length){
          Module.stream.onCompleted();
	}
      }, function Fail(err){
	done(err);
     }, function Done(){
	done();
     }); // END subscribe

//======================================= start example
   setTimeout(function () {
//+++++++++++++++++++++++++++++++++++++++++++++ create
     Module.create({ text: Values[0] })
     .then(function (chatMessage) {
       chatMessage.text = Values[1];
//+++++++++++++++++++++++++++++++++++++++++++++ update
       return chatMessage.save();
     }).then(function (chatMessage) {
         chatMessage.text = Values[2];
//+++++++++++++++++++++++++++++++++++++++++++++ updatd
         chatMessage.save();
     }) // END then
     .catch(function errorHandler(){
       assert.doesNotThrow(fn, Error, 'function does not throw');
     }); // END catch
   }, 150); // END setTimeout
  }); // END it should work with module using auto timestamps
	
//=====================================================
  it('should emit when removing', function(done){
//=====================================================

//=========================================== generator
    const Module = modulePlus('TEST'+genRandomId(),	new Schema({ text: String }));

//===================================== expected events

   const text = faker.Name.findName();
   let step = 1;
    let outputVal = { };
//===================================== start listening
   Module.stream.subscribe(
			  function Data(doc){		
			if (1 === step) {
				rfc6902.applyPatch(outputVal,doc.toObject().patchs)
				assert.equal(outputVal.text, text,"Checking the core value");
				assert.equal(doc.target+"", outputVal._id+"","Checking the id value");
				assert.equal(doc.action, "CREATE","Should be the first event");
				assert.equal(Object.prototype.toString.call(doc.createdAt), "[object Date]","Should have createdAt");
	                 step++;
	                } else	if (2 === step) {
				assert.equal(doc.action, "DELETE","Should be the first event");
				Module.stream.onCompleted();
			}
						
			}, function Fail(err){
						done(err);
			}, function Done(){
						done();
			}); // END subscribe

//======================================= start example
setTimeout(function () {

//+++++++++++++++++++++++++++++++++++++++++++++ create
  Module.create({ text })
  
  .then(function (chatMessage) {
//+++++++++++++++++++++++++++++++++++++++++++++ remove
    return chatMessage.remove();
  })
		.catch(done)
}, 150); // END setTimeout

	}); // END it should work with module using auto timestamps

	
	
}); // END describe - mongoose model stream
