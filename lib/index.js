const {default: PQueue} = require('p-queue');
const extend  = require('extend')
const { v4: uuidv4 } = require('uuid')
const {CronJob} = require('cron');
// TODO replace 'cron' with 'node-crone' as it does not allow to detroy the cron
//    do more study on cron internal sturcture
const {MemoryStore} = require('./memory-store.js')
//const logger = require('../logger.js')(module)

const statusOrder ={
  addedToQueue: 'started',
  started: 'completed',
  completed: 'false',
  failed: false,
  halted: false
}

class WorkOnTime {
  constructor (opts = {}) {
    this.jobs = {}
    this.store = opts.store || new MemoryStore()
    this.runInterval = opts.runInterval || 1000
    this.onStart = opts.onStart
    this.onFail = opts.onFail
    this.queues = {}
    this.setIntervalId
    this._jobsInQueue = {}
    this.cronTasks = {}
    this.nowThreshold = opts.nowThreshold || 0
  }

  init () {
    return this.store.init()
  }

  start () {
    // this.setIntervalId = setInterval(() => {
    //   this._process()
    // }, this.runInterval)
    return Promise.resolve().then(() => {
      return this.loadCronTasks()
    }).then(() => {
      return this.loadScheduledTasks()
    })
  }

  defineJob (options = {}) {
    const {
      name, worker, priority = 0,
      concurrency = 5, intervalCap = Infinity, interval = 0,
      onStart, onComplete, onFail,
      storeResult = false
    } = options
    if (this.jobs[name]) return new Error('Job already defined')
    if (!worker) return new Error("Job's worker fucntion not given")
    this.jobs[name] = {
      name, worker,
      onStart, onComplete, onFail, storeResult,
      queue: new PQueue({concurrency, intervalCap, interval, priority})
    }
  }

  /**
   * task porperties:
   * data
   * job: name of the job
   * when [optional]
   */
  add (userTask) {
    const wot = this
    if (!userTask.job) return Promise.reject(new SyntaxError('Parameter missing: job'))
    if (!this.jobs[userTask.job])
      return Promise.reject(new Error('Job not defined: ' + userTask.job))
    const curTime = Date.now()
    const when = getWhenType(userTask.when || curTime)
    console.log('Adding task when', {userTask, when})
    if (when.type === 'cron') {
      console.log('Adding cron task', {userTask})
      // add cron job
      return this._addCronTask(userTask)
    } else {
      console.log('Adding scheduled task', {userTask})
      const task = {
        job: userTask.job,
        data: userTask.data,
        when: when.value,
        uuid: uuidv4(),
        created: curTime,
        isActive: true,
        status: {}
      }
      return this.store.add(task)
      .then(() => {
        wot._createCronTask(task,
          wot._scheduledOnTick(task))
      })
    }
  }

  loadCronTasks () {
    const wot = this
    return this.store.getCronTasks()
    .then(tasks => {
      console.log('cron tasks to be loaded: '+ tasks.length)
      console.log('cron tasks list: '+ tasks.length, {tasks})
      tasks.forEach(task => {
        wot._createCronTask(task,
          wot._cronOnTick(task))
      })
      return Promise.resolve(true)
    })
  }

  loadScheduledTasks () {
    const wot = this
    return this.store.incompleteTasks()
    .then(tasks => {
      console.log('scheduled tasks to be loaded: '+ tasks.length)
      console.log('scheduled tasks list: '+ tasks.length, {tasks})
      tasks.forEach(task => {
        wot._createCronTask(task,
          wot._scheduledOnTick(task))
      })
    })
  }

  _addCronTask (userTask) {
    const wot = this
    return Promise.resolve().then(() => {
      // this add to data store if db then it's persisted
      return this.store.addCronTask({
        job: userTask.job,
        data: userTask.data,
        when: userTask.when,
        uuid: uuidv4(),
        created: Date.now(),
        isActive: true
      })
    }).then(() => {
      // add to node-cron in memory
      return wot._createCronTask(userTask,
        wot._cronOnTick(userTask))
    })
  }

  _createCronTask (userTask, onTick) {
    const wot = this
    let when
    if (Number.isInteger(userTask.when)) {
      if (userTask.when < (Date.now() + this.nowThreshold))
        when = new Date(Date.now() + this.nowThreshold)
      else when = new Date(userTask.when)
    } else if (typeof(userTask.when) === 'string') {
      when = userTask.when
    } else {
      when = new Date()
    }
    const cronTask = new CronJob(
      when,
      onTick,
      function () {
        console.log('task stopped: ' + JSON.stringify(userTask))
      },
       false, 'Asia/Kolkata')
    if (userTask.isActive) cronTask.start()
    this.cronTasks[userTask.uuid] = cronTask
  }

  _cronOnTick (userTask) {
    const wot = this
    return function() {
      const curTime = Date.now()
      const task = {
        job: userTask.job,
        data: userTask.data,
        when: curTime,
        uuid: userTask.job + '-' + curTime,
        created: curTime,
        status: {}
      }
      return wot.store.add(task)
      .then(() => {
        return wot._addTaskToQueue(task)
      })
    }
  }

  _scheduledOnTick (task) {
    const wot = this
    return function() {
      return wot._addTaskToQueue(task)
    }
  }

  remove (uuid) {
  }

  setPriority (uuid, priority) {
  }

  tasks (opts) {
    return this.store.getTasks(opts)
  }

  getCronTasks (opts) {
    return this.store.getCronTasks(opts)
  }

  pauseTask (uuid) {
    if (this.cronTasks[uuid]) {
      return this.pauseCronTask(uuid)
    } else {
      return Promise.reject('TODO not implimented')
    }
  }

  pauseCronTask (uuid) {
    const wot = this
    return this.store.patchCronTask(uuid, {isActive: false})
    .then(res => {
      console.log('pauseCronTasks update store' + JSON.stringify(res))
      if (wot.cronTasks[uuid]) {
        wot.cronTasks[uuid].stop()
        return Promise.resolve(true)
      } else {
        console.error('In node cron UUID not found: ' + uuid)
        return Promise.reject(new Error('Invalid UUID: ' +uuid))
      }
    })
  }

  startTask (uuid) {
    if (this.cronTasks[uuid]) {
      return this.startCronTask(uuid)
    } else {
      return Promise.reject('TODO not implimented')
    }
  }

  startCronTask (uuid) {
    const wot = this
    return this.store.patchCronTask(uuid, {isActive: true})
    .then(res => {
      console.log('startCronTasks update store' + JSON.stringify(res))
      if (wot.cronTasks[uuid]) {
        wot.cronTasks[uuid].start()
        return Promise.resolve(true)
      } else {
        console.error('In node cron UUID not found: ' + uuid)
        return Promise.reject(new Error('Invalid UUID: ' +uuid))
      }
    })
  }

  endCronTask (uuid) {

  }

  _tasksToBeQueued () {
    // takes non completed jobs from store
    // filter only those are not in queue
    const tillWhen = Date.now() + this.runInterval
    const wot = this
    return this.store.incompleteTasks(tillWhen)
    .then(tasks => {
      // console.log('tasks not complete nor failed: ' + tasks.map(t => t.uuid).join(', '))
      return Promise.resolve(tasks.filter(t => !wot._jobsInQueue[t.uuid]))
    })
  }

  _process () {
    const wot = this
    return this._tasksToBeQueued()
    .then(tasks => {
      if (tasks.length === 0) return Promise.resolve(false)
      // console.log('tasks to be queued: ' + tasks.map(t => t.uuid).join(', '))
      let tasksPromises = tasks.map(task => {
        return wot._addTaskToQueue(task)
      })
      return Promise.all(tasksPromises)
    })
  }

  _addTaskToQueue (task) {
    // not considering right now task.when
    const wot = this
    this._jobsInQueue[task.uuid] = true
    return this.store.setStatus(task.uuid, {addedToQueue: Date.now()})
    .then(task => {
      const job = wot.jobs[task.job]
      return job.queue.add(() => {
        return wot._processTask(task, job)
      })
    })
  }

  _processTask (task, job) {
    // created not part of status
    // status: addedToQueue, started, completed, failed
    // console.log('task data: ', task.data)
    const wot = this
    let finalResult
    return this.store.patchTask(task.uuid, {status: {started: Date.now()}})
    .then(task => {
      if (job.onStart) {
        job.onStart(task)
      } else if (wot.onStart) {
        wot.onStart(task)
      }
      return job.worker(task)
    }).then(result => {
      console.log('[wot] Task completed')
      finalResult = result
      const update = {status: {completed: Date.now()}}
      if (job.storeResult) update.result = result
      return wot.store.patchTask(task.uuid, update)
    }).then(task => {
      // console.log('final data in task: ' + JSON.stringify(task))
      console.log('[wot] Deleting in process task uuid')
      delete wot._jobsInQueue[task.uuid]
      if (job.onComplete) return job.onComplete(finalResult)
      else return Promise.resolve(finalResult)
    })
    .catch(error => {
      console.error('[wot] Error: ' + error.message)
      const update = {status: {failed: Date.now()},
        message: error.message
      }
      wot.store.patchTask(task.uuid, update)
      delete wot._jobsInQueue[task.uuid]
      error.task = task
      if (job.onFail) {
        return job.onFail(error)
      } else if (wot.onFail) {
        return wot.onFail(error)
      }
      //return Promise.reject(error)
    })
  }
}

function getWhenType (when) {
  if (typeof when.getMonth === 'function') {
     return {type: 'epoch', value: when.valueOf()}
  } else if (Number.isInteger(when)) {
    return { type: 'epoch', value: when}
  } else if (typeof when === 'string') {
    let val = filterInt(when)
    if (Number.isInteger(val)) {
      return {type: 'epoch', value: val}
    } else {
      return {type: 'cron', value: when}
    }
  }
}

// from MDN https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseInt#a_stricter_parse_function
function filterInt(value) {
  if (/^[-+]?(\d+|Infinity)$/.test(value)) {
    return Number(value)
  } else {
    return NaN
  }
}
module.exports.WorkOnTime = WorkOnTime
