const {default: PQueue} = require('p-queue');
const Promise = require('bluebird');
const extend  = require('extend');
const {CronJob} = require('cron');
const {AbortController} = require("abort-controller");
// TODO replace 'cron' with 'node-crone' as it does not allow to detroy the cron
//    do more study on cron internal sturcture
const {MongoStore} = require('./mongo-store.js');
const {Task} = require('./task.js');

const statusOrder ={
  addedToQueue: 'started',
  started: 'completed',
  completed: 'false',
  failed: false,
  halted: false
}

class WorkOnTime {
  constructor (opts = {}) {  // required
    this.jobs = {};
    this.store = createStore(opts);
    this.runInterval = opts.runInterval || 1000
    this.onStart = opts.onStart
    this.onFail = opts.onFail
    this.setIntervalId
    this._jobsInQueue = {}
    this.crons = {}
    this.nowThreshold = opts.nowThreshold || 100
    this._started = false
    this._initiated = false
  }

  init () {  // required
    if (!this._initiated) {
      const wot = this
      return this.store.init();
    } else {
      return Promise.reject(new Error('Already initiated'));
    }
  }

  restart () {  // required
    const wot = this;
    if (this._started) {
      return this.stop().then(() => wot._start());
    } else {
      return this._start();
    }
  }

  _start () {
    const tasks = {};
    if (!this._started) {
      this._started = true;
      return Promise.resolve().then(() => {
        return this._loadCronTasks().then(count => {
          tasks.cronTasks = count;
          return Promise.resolve();
        })
      }).then(() => {
        return this._loadScheduledTasks().then(count => {
          tasks.scheduledTasks = count;
          return Promise.resolve();
        })
      })
    } else {
      return Promise.reject(new Error('System is already up'));
    }
  }
  __stop () {  // TODO rename it

  }

  defineJob (options = {}) {  // required
    const {
      name, worker, priority = 0,
      progress, pause, stop, start,
      concurrency = 5, intervalCap = Infinity, interval = 0,
      onStart, onComplete, onStop, onFail,
      storeResult = false, persistTaskStatus = true, persistCronStatus = true
    } = options
    if (!name) return new Error('name of job not provided');
    if (this.jobs[name]) return new Error('Job already defined')
    if (!worker) return new Error("Job's worker function not provided")
    this.jobs[name] = {
      name, worker,
      progress, pause, stop, start,
      onStart: onStart || this.onStart,
      onComplete: onComplete || this.onComplete,
      onStop: onStop || this.onStop,
      onFail: onFail || this.onFail,
      storeResult, persistTaskStatus,
      persistCronStatus,
      queue: new PQueue({concurrency, intervalCap, interval, priority})
    }
  }

  /**
   * task porperties:
   * when [optional]
   */
  addTask (userTask) {  // required
    const wot = this
    if (!userTask.job) return Promise.reject(new SyntaxError('Parameter missing: job'))
    let job = this.jobs[userTask.job]
    if (!job)
      return Promise.reject(new Error('Job not defined: ' + userTask.job));
    const task = new Task(userTask, job, this.store);
    //return this.store.addTask(userTask, job).then(task => {
    return task.save().then(() => {
      // (TDOD relook return) OK your task is added we'll process it as per 'when' parameter
      if (task.isCron) {
        wot._createCronTask(task)
        .then(() => Promise.resolve(task));
      } else {
        wot._addTaskToQueue(task)
        .then(() => Promise.resolve(task));
      }
      return Promise.resolve(task);
    });
  }

  _addTaskToQueue (task) {  // required
    const wot = this
    this._jobsInQueue[task.uuid] = task;
    task.status.addedToQueue = Date.now();
    return task.save().then(() => {
      return task.job.queue.add(() => {
        wot._processTask(task)
      })
    })
  }

  _createCronTask (task) {  // required
    const wot = this
    const cronTask = new CronJob(
      task.when,
      function () {
        task.spinCronTask().then(spinned => {
          wot._addTaskToQueue(spinned);
        })
      },
      function () {
        // TODO
        console.log('task stopped: ' + JSON.stringify(task.toPlainObject()))
      },
      false, 'Asia/Kolkata')  //TODO time zone as config
    if (task.isActive) cronTask.start()
    this.crons[task.uuid] = cronTask
    return Promise.resolve(true);
  }

  _processTask (task) {  // required
    // console.log('task: to process: ' + JSON.stringify(task))
    // status: created, addedToQueue, started, completed, failed
    // console.log('task data: ', task.data)
    // check if task need to be started
    if (!task.shouldProcess()) return Promise.resolve(false)
    const wot = this;
    const job = task.job;
    task.status.started = Date.now();
    task.abortController = new AbortController();
    const signal = task.abortController.signal;

    return task.save().then(() => {
      if (job.onStart) job.onStart(task.toPlainObject());
      // the actual function of task is executed now
      const output = job.worker(task.data, signal);
      return Promise.resolve(output).catch(error => {
        // task failed, handle it
        task.status.failed = Date.now();
        // TODO convert error with serialize-error
        task.error = error.message;
        delete wot._jobsInQueue[task.uuid]
        if (job.onFail) job.onFail(error, task.toPlainObject());
        return task.save()
        .then(() => {
          return Promise.reject(error);
        })
      })
    }).then(result => {
      task.status.completed = Date.now();
      //if (task.storeResult && notEmpty(result)) task.result = result;
      task.save(result).then(() => {
        delete wot._jobsInQueue[task.uuid];
        if (job.onComplete) job.onComplete(result, task.toPlainObject());
        return Promise.resolve(result);
      });
    }).catch(err => {
      // these are wot server errors,
      // worker errors are handled while running the worker
      return Promise.reject(err);
    })
  }

  _loadCronTasks () {  // required
    const wot = this
    return this.store.getCronTasks()
    .then(taskList => {
      // console.log('cron tasks to be loaded: '+ tasks.length)
      // console.log('cron tasks list: '+ tasks.length, {tasks})
      return Promise.mapSeries(taskList, taskData => {
        let job = wot.jobs[taskData.job]
        if (!job)
          return Promise.reject(new Error('Job not defined: ' + taskData.job));
        const task = Task.createTask(taskData, wot.jobs[taskData.job],
          wot.store);
        return wot._createCronTask(task);
      }).then(() => {
        return Promise.resolve(taskList.count);
      })
    })
  }

  _loadScheduledTasks () {  // required
    const wot = this
    return this.store.getIncompleteTasks()
    .then(tasks => {
      // console.log('scheduled tasks to be loaded: '+ tasks.length)
      // console.log('scheduled tasks list: '+ tasks.length, {tasks})
      // in the below execution _createTaskFromOld is detached
      // return Promise.mapSeries(tasks, wot._createTaskFromOld)
      return Promise.mapSeries(tasks, taskData => {
        return wot._createTaskFromOld(taskData);
      }).then(() => {
        return Promise.resolve(tasks.count);
      })
    })
  }

  _createTaskFromOld (oldTaskData) {
    // console.log('oldTaskData: ' + JSON.stringify(oldTaskData));
    const job = this.jobs[oldTaskData.job];
    if (!job) throw new Error('job is not defined: ' + oldTaskData.job);
    const oldTask = Task.createTask(oldTaskData, job, this.store);
    oldTask.status.abandoned = Date.now();
    // add new task with same data
    const oldTaskUuid = oldTaskData.uuid;
    delete oldTaskData.uuid;
    const newTaskData = oldTaskData;
    newTaskData.parentTask = oldTaskUuid;

    const newTask = new Task(newTaskData, job, this.store);
    //return wot.addTask(newTaskData).then(newTask => {
    newTask.parentTask = oldTaskUuid;
    oldTask.childTask = newTask.uuid;
    return oldTask.save().then(() => {
      return newTask.save();
    });
  }

  getTasks (opts) {
    return this.store.getTasks(opts)
  }

  getCronTasks (opts) {
    return this.store.getCronTasks(opts)
  }

  // task related actions

  stopTask (uuid, reason) {
    if (this.crons[uuid]) {
      return this._stopCron(uuid, reason)
    } else if (this._jobsInQueue[uuid]) {
      return this._stopScheduledTask(uuid, reason)
    } else {
      return Promise.reject(new Error('Task not running'))
    }
  }

  _stopCron (uuid) {
    const wot = this;
    const cron = this.crons[uuid];
    return this.store.getTask(uuid).then(taskData => {
      const job = wot.jobs[taskData.job];
      const task = Task.createTask(taskData, job, wot.store);
      task.isActive = false
      task.status.stopped = Date.now();
      return task.save().then(()=> {
        return Promise.resolve(cron.stop()).then(() => {
          return task.toPlainObject();
        })
      })
    });
  }

  _stopScheduledTask (uuid, reason) {
    let task = this._jobsInQueue[uuid];
    if (task) {
      task.isActive = false;
      task.status.stopped = Date.now();
      delete this._jobsInQueue[uuid];
      // can not be removed from job queue
      // but will not be processes as status is stopped
      task.abortController.abort(reason);
      return task.save().then(() => Promise.resolve(task.toPlainObject()));
    } else {
      return Promise.reject(new Error('Task not running'))
    }
  }

  restartTask (uuid) {
    if (this.crons[uuid]) {
      return this._restartCronTask(uuid)
    } else {
      return this._restartScheduledTask(uuid)
    }
  }

  _restartCronTask (uuid) {
    const wot = this;
    return this.store.patchTask(uuid, {isActive: true})
    .then(res => {
      // console.log('startCronTasks update store' + JSON.stringify(res))
      if (wot.crons[uuid]) {
        wot.crons[uuid].start()
        return Promise.resolve(true)
      } else {
        // console.error('In node cron UUID not found: ' + uuid)
        return Promise.reject(new Error('Invalid UUID: ' +uuid))
      }
    })
  }

  // stop the existing task if running
  // create a new task with task data
  _restartScheduledTask (uuid) {
    const wot = this;
    return this._stopScheduledTask(uuid, 'resuming the task')
    .then(() => {
      return wot.store.getTask(uuid).then((taskData) => {
        return wot._createTaskFromOld(taskData);
      });
    });
  }

  // stop task if task is running
  // then mark this as deleted
  // so that when tasks are loaded this task should not be loaded
  delete (uuid) {
    const wot = this;
    return this._stopScheduledTask(uuid, 'Stopping the task')
    .then(() => {
      return wot.store.addStatus(uuid, 'deleted', Date.now());
    });
  }

  setPriority (uuid, priority) {
  }
}

function createStore(opts) {
  if (opts.mongoUri) {
    // console.log('store config: ' + JSON.stringify(opts));
    return new MongoStore({
      uri: opts.mongoUri,
      db: opts.db,
      collection: opts.collection
    })
  } else {
    return new MongoStore()
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

function findTaskStatusPersistance (task, job) {
  if (task.hasOwnProperty('persistTaskStatus')) {
    return task.persistTaskStatus
  } else if (job.hasOwnProperty('persistTaskStatus')) {
    return job.persistTaskStatus
  } else {
    return true
  }
}

module.exports.WorkOnTime = WorkOnTime
