const {default: PQueue} = require('p-queue');
const Promise = require('bluebird');
const extend  = require('extend');
const {EventEmitter} = require('events');
const {CronJob} = require('cron');
const {AbortController} = require("abort-controller");
// TODO replace 'cron' with 'node-crone' as it does not allow to destroy the cron
//    do more study on cron internal sturcture
const {Worker} = require('./worker.js');
const {MongoStore} = require('./mongo-store.js');
const {Task} = require('./task.js');

const statusOrder ={
  addedToQueue: 'started',
  started: 'completed',
  completed: 'false',
  failed: false,
  halted: false
}

class WorkOnTime extends EventEmitter {
  constructor (options = {}) {  // required
    super();
    this.workers = {};
    this.store = createStore(options);
    this.runInterval = options.runInterval || 1000
    // this.onStart = options.onStart
    // this.onFail = options.onFail
    // this.onComplete = options.onComplete
    // this.onNotRunnable = options.onNotRunnable
    this.setIntervalId
    this._jobsInQueue = {}
    this.crons = {}
    this.nowThreshold = options.nowThreshold || 1000
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

  addWorker (worker) {
    if (!worker instanceof Worker) {
      throw new Error('addWorker method requires instance of Worker');
    }
    if (this.workers[worker.name])
      throw new Error('Worker already added: ' + worker.name);
    this.workers[worker.name] = worker;
  }

  defineWorker (options = {}) {
    const worker = new Worker(options);
    this.addWorker(worker);
    return worker;
  }

  /**
   * task porperties:
   * worker: function to do the work
   * when [optional]
   */
  addTask (userTask) {  // required
    const wot = this
    if (!userTask.worker) return Promise.reject(new SyntaxError('Parameter missing: worker'))
    const worker = this.workers[userTask.worker]
    if (!worker)
      return Promise.reject(new Error('Job not defined: ' + userTask.worker));
    const task = new Task(userTask, worker, this.store, this.nowThreshold);
    // check schedule time is not past
    if (task.isCron && !task.isRepetitive) {
      if (task.when.valueOf() < Date.now() + this.nowThreshold) {
        return Promise.reject(new Error('Schedule time is in past.'));
      }
    }
    return this._addTaskToSystem(task);
  }

  _addTaskToSystem (task) {
    const wot = this
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
      return task.worker.queue.add(() => {
        return wot._processTask(task)
      })
    })
  }

  _createCronTask (task) {  // required
    const wot = this
    const cronTask = new CronJob(
      task.when,
      function () {
        if (task.isRepetitive) {
          return task.spinCronTask().then(spinned => {
            return wot._addTaskToQueue(spinned);
          });
        } else {
          return wot._addTaskToQueue(task);
        }
      },
      function () {
        // TODO
        console.log('task stopped: ' + JSON.stringify(task.toPlainObject()))
      },
      false, 'Asia/Kolkata')  //TODO time zone as config
    try {
      if (task.isActive) cronTask.start()
    } catch (error) {
      //if (wot.onNotRunnable) wot.onNotRunnable(error, task.toPlainObject())
      task.worker.emit('fail', error, task.toPlainObject());
    }
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
    const worker = task.worker;
    task.status.started = Date.now();
    task.abortController = new AbortController();
    const signal = task.abortController.signal;

    return task.save().then(() => {
      // if (worker.onStart) worker.onStart(task.toPlainObject());
      worker.emit('start', task.toPlainObject());
      // the actual function of task is executed now
      // NOTE: unhandled promise rejection would not be caught
      return worker.handler(task.data, signal)
      .then(result => {
        task.status.completed = Date.now();
        //if (task.storeResult && notEmpty(result)) task.result = result;
        return task.save(result).then(() => {
          delete wot._jobsInQueue[task.uuid];
          //if (worker.onComplete) worker.onComplete(result, task.toPlainObject());
          worker.emit('complete', result, task.toPlainObject())
          return Promise.resolve(result);
        });
      })
      .catch(error => {
        // task failed, handle it
        task.status.failed = Date.now();
        // TODO convert error with serialize-error
        task.error = error.message;
        delete wot._jobsInQueue[task.uuid]
        /*if (worker.onFail) {
          worker.onFail(error, task.toPlainObject())
          .catch(err => {
            console.log('catched onFail error');
            // catch err but nothing can be done
            // if handler's onFail is throwing
          })
        }*/
        worker.emit('fail', error, task.toPlainObject())
        return task.save()
          .catch(error => {
            wot.emit('error', error);
          })
      })
    })
    // }).then(result => {
    //   task.status.completed = Date.now();
    //   //if (task.storeResult && notEmpty(result)) task.result = result;
    //   task.save(result).then(() => {
    //     delete wot._jobsInQueue[task.uuid];
    //     if (worker.onComplete) worker.onComplete(result, task.toPlainObject());
    //     return Promise.resolve(result);
    //   });
    // }).catch(err => {
    //   // these are wot server errors,
    //   // handler errors are handled while running the handler
    //   return Promise.reject(err);
    // })
  }

  _loadCronTasks () {  // required
    const wot = this
    return this.store.getActiveCronTasks()
    .then(taskList => {
      // console.log('cron tasks to be loaded: '+ tasks.length)
      // console.log('cron tasks list: '+ tasks.length, {tasks})
      return Promise.mapSeries(taskList, async taskData => {
        let worker = wot.workers[taskData.worker]
        if (!worker)
          wot.emit('error', new Error('Worker not defined: ' + taskData.worker));
        const task = Task.createTask(taskData, wot.workers[taskData.worker],
          wot.store);
        if (task.isOld()) {
          // const spinned = await task.spinCronTask();
          // task.status.isActive = false;
          // await task.save();
          return wot._addTaskToQueue(task);
        } else {
          return wot._createCronTask(task);
        }
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
    // TODO there are two approaches
    // 1) abandon the old one and create a new with same data (already implemented)
    // 2) retsart the old one keep status.created same and refresh all
    //    other statuses.
    // No 2 approach seems better as the task id remains same and
    //  might have been referred somewhere
    // console.log('oldTaskData: ' + JSON.stringify(oldTaskData));
    const worker = this.workers[oldTaskData.worker];
    if (!worker) throw new Error('worker is not defined: ' + oldTaskData.worker);
    const oldTask = Task.createTask(oldTaskData, worker, this.store);
    oldTask.status.abandoned = Date.now();
    // add new task with same data
    const oldTaskUuid = oldTaskData.uuid;
    delete oldTaskData.uuid;
    const newTaskData = oldTaskData;
    newTaskData.parentTask = oldTaskUuid;

    const newTask = new Task(newTaskData, worker, this.store);
    //return wot.addTask(newTaskData).then(newTask => {
    newTask.parentTask = oldTaskUuid;
    oldTask.childTask = newTask.uuid;
    return oldTask.save().then(() => {
      return newTask.save();
    });
  }

  getTasks (options) {
    return this.store.getTasks(options)
  }

  async getCronTasks (options) {
    return this.store.getCronTasks(options)
  }

  getWorkers (options) {
    return JSON.stringify(this.workers);
  }
  // task related actions

  stopTask (uuid, reason) {
    if (this.crons[uuid]) {
      return this._stopCron(uuid, reason)
    } else if (this._jobsInQueue[uuid]) {
      return this._stopScheduledTask(uuid, reason)
    } else {
      const error = new Error('No task: ' + uuid)
      error.statusCode = 404;
      return Promise.reject(error);
    }
  }

  _stopCron (uuid) {
    const wot = this;
    const cron = this.crons[uuid];
    return this.store.getTask(uuid).then(taskData => {
      const worker = wot.workers[taskData.worker];
      const task = Task.createTask(taskData, worker, wot.store);
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
      task.error = reason || 'Stopped';
      delete this._jobsInQueue[uuid];
      // can not be removed from worker queue
      // but will not be processes as status is stopped
      task.abortController.abort(reason);
      return task.save().then(() => Promise.resolve(task.toPlainObject()));
    } else {
      const error = new Error('No task: ' + uuid)
      error.statusCode = 404;
      this.emit('error', error);
      return Promise.resolve();
    }
  }

  restartTask (uuid) {
    if (this.crons[uuid]) {
      return this._restartCronTask(uuid)
    } else {
      return this._restartScheduledTask(uuid)
    }
  }

  async _restartCronTask (uuid) {
    const wot = this;
    const cron = this.crons[uuid];
    return this.store.getTask(uuid).then(async taskData => {
      const worker = wot.workers[taskData.worker];
      const task = Task.createTask(taskData || {}, worker, wot.store);
      if (task.isOld()) {
        return wot._addTaskToQueue(task);
      } else {
        task.isActive = true
        task.status.restarted = Date.now();
        return task.save().then(()=> {
          return Promise.resolve(cron.start()).then(() => {
            return task.toPlainObject();
          })
        })
      }
    });
  }

  // stop the existing task if running
  // create a new task with task data
  async _restartScheduledTask (uuid) {
    const wot = this;
    await this._stopScheduledTask(uuid, 'resuming the task');

    const taskData = await this.store.getTask(uuid);
    const task = await wot._createTaskFromOld(taskData);
    if (task) {
      return this._addTaskToSystem(task);
    } else {
      const error = new Error('No task: ' + uuid)
      error.statusCode = 404;
      this.emit('error', error);
    }
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

function createStore(options) {
  if (options.mongoUri) {
    // console.log('store config: ' + JSON.stringify(options));
    return new MongoStore({
      uri: options.mongoUri,
      db: options.db,
      collection: options.collection
    })
  } else {
    return new MongoStore()
  }
}

function findTaskStatusPersistance (task, worker) {
  if (task.hasOwnProperty('persistTaskStatus')) {
    return task.persistTaskStatus
  } else if (worker.hasOwnProperty('persistTaskStatus')) {
    return worker.persistTaskStatus
  } else {
    return true
  }
}

module.exports.WorkOnTime = WorkOnTime
