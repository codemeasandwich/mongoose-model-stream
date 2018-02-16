# mongoose-model-stream

a mongoose model generator with a change stream

**info:**

[![npm version](https://badge.fury.io/js/mongoose-model-stream.svg)](https://www.npmjs.com/package/mongoose-model-stream)
[![License](http://img.shields.io/:license-apache_2-yellow.svg)](https://www.apache.org/licenses/LICENSE-2.0)


### If this was helpful, [★ it on github](https://github.com/codemeasandwich/mongoose-model-stream)

# Install

`yarn add mongoose-model-stream` or `npm install --save mongoose-model-stream`

# How to Use

``` js
const modelPlus = require('mongoose-model-stream');
```

### constructor

This `modelPlus` function takes two arguments.

* `modelName`: The name of the model
* `schema` : The schema definition of the model.

There is also an optional 3rd argument.

* `enableDownStream` : Change will create change events, without listening to the stream for updates. *(Default: `true`)*


``` js
const ChatSchema = new mongoose.schema({
  text: String
});

const Chat = modelPlus('Chat', ChatSchema);
```

# v2.x.x Api

Attached to `Chat` will be a `.stream` baced on [RxJs]. This will **emit** change events baced on [rfc6902]

The payload looks like:

| Property | Type |Description
|--- |--- |---
| patchs | Array | Present for all changes to the item. - An array of [rfc6902] operations.
| target | String(ID) | The Unique identifier for the item

## run samples

``` bash
node example/sample.js
```

---

# v1.x.x Api

### stream$ (think of it like "find", but tailing the collection)
An [RxJs] [Observable](http://reactivex.io/rxjs/class/es6/Observable.js~Observable.html) for change events like ('create', 'update', 'remove' &  ['restore'](https://npmjs.com/codemeasandwich/mongoose-model-restore))

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

# v1.x.x Example

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

[RxJs]: http://reactivex.io/rxjs/
[rfc6902]: https://tools.ietf.org/html/rfc6902
