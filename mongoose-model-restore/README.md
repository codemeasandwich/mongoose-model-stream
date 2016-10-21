# mongoose-model-stream

a mongoose model generator with a change stream

**info:**

[![npm version](https://badge.fury.io/js/mongoose-model-stream.svg)](https://badge.fury.io/js/graphql-mongoose-model-stream)
[![License](http://img.shields.io/:license-apache_2-yellow.svg)](https://www.apache.org/licenses/LICENSE-2.0)
[![pull requests welcome](https://img.shields.io/badge/Pull%20requests-welcome-pink.svg)](https://github.com/codemeasandwich/mongoose-model-stream/pulls)


### If this was helpful, [★ it on github](https://github.com/codemeasandwich/mongoose-model-stream)


## [Demo / Sandbox](https://tonicdev.com/codemeasandwich/57a0727c80254315001cb366) :thumbsup:

# Install

`npm install mongoose-model-stream`

# Api

``` js
const modelPlus = require('mongoose-model-stream');
```

### constructor
query/mutator you wish to use, and an alias or filter arguments.

| Argument (**one** to **two**)  | Description
|--- |---
| String | modelNameS: name of model
| Object | schema: model definition
| * Bool | (**optional**) enableDownStream = TRUE : Should start listening for changes and __ADD__ stream$ PROP
"mongoose-model-stream" will always push changes, but the '**enableDownStream**' options is wheat you want to also receive changes. 
**e.g.**  a "**log**"! you would want to push changes but an a large site. This this would be a lot of traffic, that only an Admin interface would want to listen for.

``` js
const ChatSchema = new mongoose.schema({
  text: String
});

const Chat = modelPlus('Chat', ChatSchema);
``` 

### stream$ (think of it like "find", but tailing the collection)
An [RxJs](http://reactivex.io/rxjs/) [Observable](http://reactivex.io/rxjs/class/es6/Observable.js~Observable.html) for change events like ('create', 'update', 'remove' &  ['restore'](https://npmjs.com/codemeasandwich/mongoose-model-restore))

> the event type is a string 'create', 'update', 'remove' or  'restore' 
> **That is set as the object's toSring/valueOf** 

``` js
Chat.stream$.map(function (doc) {
  return doc + ' ' + (doc == "update") + ' ' + JSON.stringify(doc) + ' ';
})
.subscribe(console.log, // data
console.error, // error
console.info); // close

 // "update true { "text":"bar", "id":"57ff5d867fb7794f9c52a21f"}"
``` 



## run samples

``` bash
node example/sample.js
```

# Example

``` js 
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const modulePlus = require('mongoose-model-stream');

//=============================================== Logic
const ChatSchema = new Schema({  text: String }, { timestamps: true });

//=========================================== generator
const ChatDB = modulePlus('Chat', ChatSchema);

//===================================== start listening
ChatDB.stream$.subscribe(console.log, console.error, console.info);

//======================================= start example
setTimeout(function () {

//+++++++++++++++++++++++++++++++++++++++++++++ create
  ChatDB.create({ text: "foo" })
  .then(function (chatMessage) {

    console.log(" >> FROM ", 'text = "' + chatMessage.text + '"');
    chatMessage.text = "bar";
    console.log(" >> TO ", 'text = "' + chatMessage.text + '"');

//+++++++++++++++++++++++++++++++++++++++++++++ update
    return chatMessage.save();
  }).then(function (chatMessage) {

    setTimeout(function () {

      console.log(" >>> FROM ", 'text = "' + chatMessage.text + '"');
      chatMessage.text = "baz";
      console.log(" >>> TO ", 'text = "' + chatMessage.text + '"');

//+++++++++++++++++++++++++++++++++++++++++++++ update

      chatMessage.save();
    }, 1000);
  });
}, 1000);
    
```