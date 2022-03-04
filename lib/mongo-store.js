const extend = require('extend');
const {MongoClient} = require('mongodb');
const Promise = require('bluebird');
const {Task} = require('./task.js');
const statusOrder = {
  addedToQueue: 'started',
  started: 'completed',
  completed: 'false',
  failed: false,
  halted: false
};

class MongoStore {
  constructor (opts = {}) {
    //if (!opts.uri) return new Error('Paramter missing: uri')
    this.uri = opts.uri || 'mongodb://127.0.0.1:27017'
    this.dbName = opts.db || 'workOnTime'
    this.collectionName = opts.collection || 'tasks'
    // this.cronTasksCollection = opts.cronTasksCollection || 'cronTasks'
    this.queryLimit = opts.queryLimit || 0
    // this.dbClient, this.db, this.collection, this.cronTasks
  }

  init () {
    const myself = this
    return MongoClient.connect(this.uri)
    .then(client => {
      myself.dbClient = client
      myself.db = client.db(myself.dbName)
      myself.collection = myself.db.collection(myself.collectionName)

      return myself.collection.createIndex({'uuid': 1}, {unique: true})
      .then(() => {
        return Promise.map(
          ['created', 'addedToQueue', 'started', 'failed', 'completed'],
          field => {
            let target ={}
            target[field] = 1
            return myself.collection.createIndex(target)
          }
        ).then(() => {
          return myself
        })
      })
    })
  }

  close () {
    return this.dbClient.close()
  }

  _addTask (taskData) {
    // const task = new Task(taskData, job, this);
    // return task.save();
    return this.collection.insertOne(taskData)
      .then(result => result.value);
  }

  getTask (uuid) {
    return this.collection.findOne({uuid})
  }

  save (uuid, taskData) {
    return this.collection.findOneAndUpdate(
      {uuid: uuid},
      {$set: taskData},
      {returnOriginal: false, upsert: true, returnDocument: "after"}
    ).then(result => result.value);
  }

  getCronTasks () {
    return this.collection.find({isCron: true, isActive: true}).toArray()
  }

  patchTask (uuid, patch) {
    return this.collection.findOneAndUpdate(
      {uuid: uuid}, {$set: patch},
      {returnOriginal: false, upsert: true}
    ).then(result => {
      return result.value
    })
  }

  getIncompleteTasks (tillWhen, limit) {
    let query = { $and: [
      {isCron: false},
      {$nor: [
        {'status.stopped': {$exists: true}},
        {'status.failed': {$exists: true}},
        {'status.completed': {$exists: true}},
        {'status.deleted': {$exists: true}}
      ]}
    ]}
    if (tillWhen) query.$and.push({when: {$lt: tillWhen}})
    return this.collection.find(query)
      .limit(limit || this.queryLimit || 0).toArray()
  }

  addStatus (uuid, curStatus, time) {
    const key = "status." + curStatus;
    const patch = {};
    patch[key] = time || Date.now();
    return this.collection.findOneAndUpdate(
      {uuid: uuid},
      {$set: patch},
      {
        returnOriginal: false,
        upsert: true, 
        //returnNewDocument: true,
        returnDocument: 'after'
      }
    ).then(result => {
      return result.value
    })
  }

  __patchTask (uuid, data) {
    let myself = this
    return this.collection.findOne({uuid}).then(task => {
      if (task) {
        extend(true, task, data)
        return myself.collection.findOneAndUpdate(
          {uuid: uuid}, {$set: task},
          {returnOriginal: false, upsert: true, returnDocument: "after"}
        ).then(result => {
          return result.value
        })
      } else {
        return myself.collection.findOneAndUpdate(
          {uuid: uuid}, {$set: data},
          {returnOriginal: false, upsert: true, returnDocument: "after"}
        ).then(result => {
          return result.value
        })
      }
    })
    // return this.collection.findOneAndUpdate(
    //   {uuid: uuid}, {$set: data},
    //   {
    //     returnOriginal: false,
    //     upsert: true, 
    //     //returnNewDocument: true,
    //     returnDocument: 'after'
    //   }
    // ).then(result => {
    //   return result.value
    // })
  }

  // TODO name can not be tasks so can we change the arrary name
  getTasks (query = {}, opts = {}) {
    return this.collection.find(query).sort({created: -1})
      .limit(opts.limit || this.queryLimit || 0).toArray()
  }
}

module.exports.MongoStore = MongoStore

