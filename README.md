# mongoose-model-stream

a mongoose model generator with a change stream

**info:**

[![npm version](https://badge.fury.io/js/mongoose-model-stream.svg)](https://www.npmjs.com/package/mongoose-model-stream)
[![License](http://img.shields.io/:license-apache_2-yellow.svg)](https://www.apache.org/licenses/LICENSE-2.0)


### If this was helpful, [★ it on github](https://github.com/codemeasandwich/mongoose-model-stream)

# Install

`yarn add mongoose-model-stream`

**or**

`npm install --save mongoose-model-stream`

# How to Use

``` js
const moduleStream = require('mongoose-model-stream');
```

### constructor

This `moduleStream` function takes two arguments.

* `modelName`: The name of the model
* `schema` : The schema definition of the model.

There is also an optional 3rd argument.

* `options` OR `enableDownStream`
    * options: the options **object** that will be passed to the change stream schema. You can set `enableDownStream` as a Property on options
    * enableDownStream: A **boolean** to change will create change events, without listening to the stream for updates. *(Default: `true`)*

``` js
const ChatSchema = new mongoose.schema({
  text: String
});

const Chat = moduleStream('Chat', ChatSchema);
```

Attached to `Chat` will be a `.stream` baced on [RxJs]. This will **emit** change events baced on [rfc6902]

The payload looks like:

| Property | Type |Description
|--- |--- |---
| patchs | Array | Present for all changes to the item. - An array of [rfc6902] operations.
| target | String(ID) | The Unique identifier for the target Object
| _id | String(ID)| The Unique identifier for this diff
| createdAt | String(Date) | The time the chage was made
| tag | String | A customisable identifier for this change
| action | String(Enum) | This will be "**CREATE**", "**UPDATE**" or "**DELETE**" depending on the state of the document in the database
| getChange | fn() ➜ Obj |  an object with only the changes applied
| getTarget | fn() ➜ promise ➜ doc |  get the target document from the Database

### model

#### Create

A new function will be added to the model

* `saveBy` : This is used the tag a change with who made it.

``` js
event.when = "today";
event.saveBy(user);
```

A `saveBy` **id** will be add to the change record

**Outputted change**
``` js
{ patchs:
   [ {
     op: 'add',
     path: '/when',
     value: 'today'
   } ],
  _id: '5a958d12fc413a44ac760fb1',
  target: '5a958d11fc413a44ac760fa9',
  saveBy: '5a95872c39c0be3afaeb9a86',
  createdAt: '2018-08-12T04:46:02.009Z',
  action: "UPDATE"
}
```

#### Update

* **"saveBy"** is also provided in the `update` function(s)
   * `update`, `updateMany`, `updateOne`, `findOneAndUpdate`, `findByIdAndUpdate`
 
You said the  **"saveBy"** bypassing it in the *"options"* argument.
This can be an **ID of an object(String)** that will be used for all patchs 
or a **function** to calculate the ID for each specific updated document

```js
const conditions = {foo:true },
updateValues = {setBarTo:false},
options = {savedBy:(oldDoc,newDoc,patchs)=>oldDoc.user_id}
event.updateMany(conditions,update,options)
```

### tag

A custom string denoting the change can be added to the following functions

 * Create
 e.g. `` const event = await Module.create({ text:updateTextTag },{ tag :"FOO_1" })``
 * save
 e.g. ``event.save("FOO_2")``  or ``event.save({ tag :"FOO_3"})`` 
 * saveBy
 e.g. ``event.saveBy(user,"FOO_4")``
 * update
 e.g. ``Module.updateOne({_id},{$set:{text:"bar"}},{ tag : "FOO_5" })``

----

# run samples

``` bash
node example/sample.js
```

# Example

``` js
require('mongoose-model-stream');
const { Schema, moduleStream } = require('mongoose');

// create a schema
const ChatSchema = new Schema({ text: String }, { timestamps: true });

// create a module
const Chat = moduleStream('Chat', ChatSchema);

// subscribe to change events
Chat.stream.subscribe(console.log, console.error, console.info);

Chat.create({ text: "foo" })
    .then(function (chatMessage) {
        chatMessage.text = "bar";
 return chatMessage.save();
    }).then(function (chatMessage) {
        chatMessage.text = "baz";
        chatMessage.save();
    }).catch(console.error);
```

### Output:

**Change: 1**
``` js
{ patchs:
   [ {
     op: 'add',
     path: '/text',
     value: :'foo'
   }, {
     op: 'add',
     path: '/_id',
     value: '5a86eea992f78d54f1cd65e9'
   }, {
     op: 'add',
     path: '/updatedAt',
     value: :'2018-08-12T04:46:01.993Z'
   }, {
     op: 'add',
     path: '/createdAt',
     value: '2018-08-12T04:46:01.993Z'
   }  ],
  _id: '5a86eeaa92f78d54f1cd65ea',
  target: '5a86eea992f78d54f1cd65e9',
  createdAt: '2018-08-12T04:46:02.009Z',
  action: "CREATE"
}
```

**Change: 2**
``` js
{ patchs:
   [ { op: 'test', path: '/updatedAt', value: '2018-08-12T04:46:01.993Z' },
     { op: 'replace', path: '/text', value: 'bar' },
     { op: 'replace', path: '/updatedAt', value: '2018-08-12T04:46:02.116Z' }, ],
  _id: '5a86eeaa92f78d54f1cd65eb',
  target: '5a86eea992f78d54f1cd65e9',
  createdAt: '2018-08-12T04:46:02.022Z',
  action: "UPDATE"
 }
```

**Change: 3**
``` js
{ patchs:
   [ { op: 'test', path: '/updatedAt', value: '2018-08-12T04:46:02.116Z' },
     { op: 'replace', path: '/text', value: 'baz' },
     { op: 'replace', path: '/updatedAt', value: '2018-08-12T04:46:02.342Z' }, ],
  _id: '5a86eeaa92f78d54f1cd65ec',
  target: '5a86eea992f78d54f1cd65e9',
  createdAt: '2018-08-12T04:46:02.122Z',
  action: "UPDATE"
 }
```
[RxJs]: http://reactivex.io/rxjs/
[rfc6902]: https://tools.ietf.org/html/rfc6902
