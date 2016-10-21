"use strict";
const assert = require('chai').assert;
const expect = require('chai').expect;
const faker = require('Faker');
const mongoose = require('mongoose');

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
//===================================== start listening
Module.stream$.subscribe(
			  function Data(doc){
						assert.equal(Test[CountOfTestIndex],   doc,      JSON.stringify(doc));
						assert.equal(Values[CountOfTestIndex], doc.text, JSON.stringify(doc));
						
						if(++CountOfTestIndex === Test.length){
									Module.stream$.onCompleted();
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
const Module = modulePlus('TEST'+genRandomId(),
																										new Schema({ text: String }));

//===================================== expected events

const Test   = ['create','update','update'];
const Values = Test.map( () => faker.Name.findName() );
let CountOfTestIndex = 0;
//===================================== start listening
Module.stream$.subscribe(
			  function Data(doc){
						assert.equal(Test[CountOfTestIndex],   doc,      JSON.stringify(doc));
						assert.equal(Values[CountOfTestIndex], doc.text, JSON.stringify(doc));
						
						if(++CountOfTestIndex === Test.length){
									Module.stream$.onCompleted();
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
//===================================== start listening
Module.stream$.subscribe(
			  function Data(doc){
						
						if (1 === step) {
									assert.equal('create',  doc,      JSON.stringify(doc));
									assert.equal(text,      doc.text, JSON.stringify(doc));
						   step++;
      } else	if (2 === step) {
									assert.equal('remove',  doc,      JSON.stringify(doc));
									assert.equal(text,      doc.text, JSON.stringify(doc));
									Module.stream$.onCompleted();
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