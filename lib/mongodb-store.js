const extend = require('extend')
const {MongoClient} = require('mongodb')
const Promise = require('bluebird')

const statusOrder = {
  addedToQueue: 'started',
  started: 'completed',
  completed: 'false',
  failed: false,
  halted: false
}

class MongoStore {
  constructor (opts = {}) {
    //if (!opts.mongoUri) return new Error('Paramter missing: mongoUri')
    this.mongoUri = opts.mongoUri || 'mongodb://127.0.0.1:27017' 
    this.dbName = opts.dbName || 'workOnTime'
    this.collectionName = opts.collectionName || 'tasks'
    this.cronTasksCollection = opts.cronTasksCollection || 'cronTasks'
    this.queryLimit = opts.queryLimit || 0
    // this.client, this.db, this.connection
  }

  init () {
    let myself = this
    return MongoClient.connect(this.mongoUri)
    .then(client => {
      myself.dbClient = client
      myself.db = client.db(myself.dbName)
      myself.collection = myself.db.collection(myself.collectionName)
      myself.cronTasks = myself.db.collection(myself.cronTasksCollection)

      return myself.collection.createIndex({'uuid': 1}, {unique: true})
      .then(() => {
        return Promise.map(
          ['created', 'addedToQueue', 'started', 'failed', 'completed'],
          field => {
            let target ={}
            target[field] = 1
            return myself.collection.createIndex(target)
          }
        )
      })
    })
  }

  add (task) {
    return this.collection.insertOne(task)
  }
  
  addCronTask (task) {
    return this.cronTasks.insertOne(task)
  }

  remove (uuid) {
  }

  setPriority (uuid, priority) {
  }

  getCronTasks () {
    return this.cronTasks.find({}).toArray() 
  }

  patchCronTask (uuid, patch) {
    return this.cronTasks.findOneAndUpdate(
      {uuid: uuid}, {$set: patch},
      {returnOriginal: false, upsert: true}
    ).then(result => {
      return result.value
    })
  }

  incompleteTasks (tillWhen, limit) {
    let query = { $and: [
      {$nor: [
        {'status.failed': {$exists: true}},
        {'status.completed': {$exists: true}}
      ]}
    ]}
    if (tillWhen) query.$and.push({when: {$lt: tillWhen}})
    return this.collection.find(query)
      .limit(this.queryLimit || limit || 0).toArray()
  }

  setStatus (uuid, status) {
    return this.collection.findOneAndUpdate(
      {uuid: uuid},
      {$set: {status: status}},
      {returnOriginal: false, upsert: true}
    ).then(result => {
      return result.value
    })
  }

  patchTask (uuid, data) {
    return this.collection.findOneAndUpdate(
      {uuid: uuid}, {$set: data},
      {returnOriginal: false, upsert: true, returnNewDocument: true}
    ).then(result => {
      return result
    })
  }

  // TODO name can not be tasks so can we change the arrary name
  getTasks (opts = {}) {
    let query = {}
    if (opts.status) {
      const nextStatus = statusOrder[opts.status]
      if (nextStatus) {
        let key = 'status.'+ opts.status
        let keyNot = 'status.' + nextStatus
        let q = {}, qNot = {}
        q[key] = {$exists: true}
        qNot[keyNot] = {$exists: false}
        query = {$and: [q, qNot]}
      } else {
        let key = 'status.'+ optsn.status
        query[key] = {$exists: true}
      }
    }
    if (opts.job) {
      query.job = opts.job
    }

    return this.collection.find(query).sort({created: -1})
      .limit(opts.limit || this.queryLimit || 0).toArray()
  }
}

module.exports.MongoStore = MongoStore

