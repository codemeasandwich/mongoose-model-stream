"use strict";
const assert = require('chai').assert;
const expect = require('chai').expect;
const faker = require('Faker');
const mongoose = require('mongoose');
const rfc6902 = require('rfc6902');

const Schema = mongoose.Schema;
  mongoose.connect('mongodb://localhost:34000/testmongoosestream',{
    useUnifiedTopology: true,
    useNewUrlParser: true,
  });

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
    const Values = Test.map(() => faker.Name.findName());
    let CountOfTestIndex = 0;
    let outputVal = { };

//===================================== start listening
    Module.stream.subscribe(
      function Data(doc){
		
		assert.equal(typeof doc.getChange, "function","document missing getChange function")
		assert.equal(typeof doc.getTarget, "function","document missing getTarget function")
		const docObj = doc.toObject()
		assert.equal(typeof docObj.getChange, "function","doc.toObject missing getChange function")
		assert.equal(typeof docObj.getTarget, "function","doc.toObject missing getTarget function")
		const docJson = doc.toJSON()
		assert.equal(typeof docJson.getChange, "undefined","doc.toJSON has getChange function")
		assert.equal(typeof docJson.getTarget, "undefined","doc.toJSON has getTarget function")
		
		if (0 === CountOfTestIndex) {
		  const change = doc.getChange()
		  assert.equal(change.text,Values[CountOfTestIndex],"text mismatch")
		  assert.equal(change._id,doc.target,"_id mismatch")
		} else if (1 === CountOfTestIndex) {
		  const change = doc.toObject().getChange()
		  assert.equal(change.text,Values[CountOfTestIndex],"text mismatch")
		}
		
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
	.catch( err => { throw err }); // END catch
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
     .catch( err => { throw err }); // END catch
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

//=====================================================
  it('should emit with tags', function(done){
//=====================================================

//=========================================== generator
  const Module = modulePlus('TEST'+genRandomId(), new Schema({ text: { type: String, required: true } }));
  const tagVals = ["create1","save2","save3","saveBy4","update5"]
  let tagsProcessed = 0
  Module.stream.subscribe(
	function Data(doc){
	  assert.equal(doc.tag, tagVals[tagsProcessed],"Tag didn't match");
	  tagsProcessed++
	  if (tagVals.length === tagsProcessed ) {
        done();
      }
	}, function Fail(err){
				done(err);
	}, function Done(){
				//done();
  }); // END subscribe

//===================================== run doc changes

	setTimeout(function () {
	  const genText = () => faker.Name.findName()

	  const updateTextTag = genText()
//+++++++++++++++++++++++++++++++++++++++++++++ create
	  Module.create({ text:updateTextTag },
					{ tag :tagVals[0] })
	  .then(doc => {
//+++++++++++++++++++++++++++++++++++++++++++++ save
		doc.text = genText()
		return doc.save({tag:tagVals[1]})
	  })
	  .then(doc => {
//+++++++++++++++++++++++++++++++++++++++++++++ save
		doc.text = genText()
		return doc.save(tagVals[2])
	  })
	  .then(doc => {
		//console.log("Here",doc)
//+++++++++++++++++++++++++++++++++++++++++++++ saveBy
		doc.text = genText()
		return doc.saveBy(doc._id,tagVals[3])
	  })
	  .then(doc => {
//+++++++++++++++++++++++++++++++++++++++++++++ update
		const updateTextTag = genText()
		return Module.updateOne({_id:doc._id},{$set: { text: updateTextTag }},{ tag : tagVals[4] })
	  })
	  .catch(done)
	}, 150); // END setTimeout
  }) // END it
	
}); // END describe - mongoose model stream
