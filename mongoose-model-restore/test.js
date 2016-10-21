"use strict";
const assert = require('chai').assert;
const expect = require('chai').expect;
const faker = require('Faker');
const mongoose = require('mongoose');

const moduleRestore = require('./index.js');

const Schema = mongoose.Schema;
															mongoose.connect('mongodb://localhost/testmongoosestream');

//=====================================================
// ============================================ helpers
//=====================================================

function genRandomId() {
  return (new Date).getTime().toString(32).toUpperCase();
}

//=====================================================
// ============================================== tests
//=====================================================

describe("mongoose model restore", function() { //log the function
			
		beforeEach(() => {
						// global setup
		});
			
	const schemaValues  = { text: String };
	const schemaOptions = { timestamps: true };
	const schema = new Schema(schemaValues, schemaOptions);

	//=====================================================
	it('should be able to remove a document', function(done){
	//=====================================================

//=========================================== generator
const Model = mongoose.model('TEST'+genRandomId(),		moduleRestore( schema ));

//======================================= start example
setTimeout(function () {
//+++++++++++++++++++++++++++++++++++++++++++++ create
  Model.create({ text: faker.Name.findName() })
  .then( chatMessage => chatMessage.remove() )
		.then( removedChatMessage => {
				  assert.isString(removedChatMessage.id);
						return Model.findById(removedChatMessage.id);
  })
		.then( chatMessage => assert.isNull(chatMessage) ) // END then
		.then( ( ) => done( ) )
		.catch( error => done(error)	) // END catch
}, 50); // END setTimeout

	}); // END it should work with module using auto timestamps

	
			
	//=====================================================
	it('should be able to remove and restore a document using >> inline', function(done){
	//=====================================================
	
	restoreTestPlace(true, done);
	
	}); // END it should work with module using auto timestamps

	
			
	//=====================================================
	it('should be able to remove and restore a document using >> moved', function(done){
	//=====================================================
	
	restoreTestPlace(false, done);
	
	}); // END it should work with module using auto timestamps
	
	function restoreTestPlace(inline, done){
	
	
	const restoreOptions = { inline };
	console.log(restoreOptions)
//=========================================== generator
const Model = mongoose.model('TEST'+genRandomId(),		moduleRestore(schema, restoreOptions) );

//======================================= start example
setTimeout( () => {
//+++++++++++++++++++++++++++++++++++++++++++++ create
  Model.create({ text: faker.Name.findName() })
		
  .then(function (docChatMessage) {
//+++++++++++++++++++++++++++++++++++++++++++++ remove
				  const jsonChatMessage = docChatMessage.toJSON();
						return Promise.all([ docChatMessage.remove(), jsonChatMessage ]);
  })
		
		.then( ([ chatMessageRemoved, chatMessage]) => {
				  assert.isUndefined(chatMessageRemoved,`remove() should return Undefined`);
console.log(" a ");
//+++++++++++++++++++++++++++++++++++++++++++++ remove
						return Promise.all([ Model.findById(chatMessage._id), chatMessage ]);
  })
		
		.then( ([ chatMessageMissing, chatMessage ]) => {
				  assert.isNull( chatMessageMissing, `findById(#) should return NULL` );
console.log(" b ",chatMessage);
				  return Promise.all([ Model.restore(chatMessage._id), chatMessage ]);
		})
		
		.then( ([ docChatMessageRestored, chatMessage ]) => {
				
console.log(" c ");
				const jsonChatMessageRestored = JSON.parse( JSON.stringify( docChatMessageRestored ) );
				const jsonChatMessage         = JSON.parse( JSON.stringify( chatMessage ) );
								
				delete jsonChatMessageRestored.updatedAt;
				delete         jsonChatMessage.updatedAt;
				
				assert.deepEqual(jsonChatMessageRestored, jsonChatMessage);
						
				return Promise.all([ Model.findById(chatMessage._id), chatMessage ]);
  })
		
		.then( ([docChatMessageFound, chatMessage]) => {
				
console.log(" d ");
						const jsonChatMessageFound = JSON.parse( JSON.stringify( docChatMessageFound.toJSON() ) );
						const jsonChatMessage      = JSON.parse( JSON.stringify( chatMessage ) );
						
						delete jsonChatMessageFound.updatedAt;
						delete      jsonChatMessage.updatedAt;
				
						assert.deepEqual(jsonChatMessage, jsonChatMessageFound);
						assert.isFalse("deletedAt" in jsonChatMessageFound);
						done();
  })
		
		.catch( error => done(error)	) // END catch
		
}, 50); // END setTimeout

	}

	
}); // END describe - mongoose model stream