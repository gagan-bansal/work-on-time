const { v4: uuidv4 } = require('uuid');
const notEmpty = require('./not-empty.js')

class Task {
  constructor (taskOptions = {}, job, store) {
    if (!job || !store) throw new Error('Insufficient parameters');
    this.uuid = uuidv4();
    this.store = store;
    this.job = job;
    this.data = taskOptions.data || null;
    const {isCron, when} = getWhenType(taskOptions.when);
    this.when = when;
    this.isCron = isCron;
    this.storeResult = taskOptions.hasOwnProperty('storeResult') ?
      taskOptions.storeResult :  job && job.hasOwnProperty('storeResult') ?
      job.storeResult : false;
    this.persistTaskStatus = taskOptions.hasOwnProperty('persistTaskStatus') ?
      taskOptions.persistTaskStatus : job && job.hasOwnProperty('persistTaskStatus') ?
      job.persistTaskStatus : true;
    this.persistCronStatus = taskOptions.hasOwnProperty('persistCronStatus') ?
      taskOptions.persistCronStatus : job && job.hasOwnProperty('persistCronStatus') ?
      job.persistCronStatus : true;
    this.parentTask = taskOptions.parentTask || false;
    this.isActive = taskOptions.isActive || true; // TODO remove it
    this.status = {
      created: Date.now()
    };
  }

  static createTask (data, job, store) {
    if (!data || !job || !store) throw new Error('missing paramters');
    // TODO what is the legent way to do the next line
    const task = new Task(data, job, store);
    task.uuid = data.uuid;
    return task;
  }

  save (result) {
    const task = this;
    let persist = false;
    if (this.persistTaskStatus) {
      persist = true
    }
    if (notEmpty(result) && this.storeResult) {
      persist = true
      this.result = result
    }
    if (persist) {
      return this.store.collection
      .findOneAndUpdate(
        {uuid: this.uuid},
        {$set: this.toPlainObject()},
        {upsert: true}
      ).then(() => Promise.resolve(task))
    } else {
      return Promise.resolve(this)
    }
  }

  toPlainObject () {
    const data = {
      uuid: this.uuid,
      job: this.job.name,
      data: this.data,
      when: typeof(this.when) === 'string'
        ? this.when : this.when.valueOf(),
      isCron: this.isCron,
      isSourceCron: this.isSourceCron || false,
      storeResult: this.storeResult,
      persistTaskStatus: this.persistTaskStatus,
      persistCronStatus: this.persistCronStatus,
      parentTask: this.parentTask,
      isActive: this.isActive,
      status: this.status
    };
    if (this.result) data.result = this.result;
    if (this.error) data.error = this.error; // TODO with serialize error
    return data;
  }

  spinCronTask () {
    const taskData = this.toPlainObject();
    delete taskData.when;
    taskData.isCron = false;
    taskData.isSourceCron = true;
    taskData.parentTask = taskData.uuid;
    taskData.persistTaskStatus = taskData.persistCronStatus;
    const spinned = new Task(taskData, this.job, this.store);
    return spinned.save();
  }

  shouldProcess () {
    const stts = this.status;
    return !stts.started && !stts.completed && !stts.failed
      && !stts.paused && !stts.stopped && !stts.deleted;
  }
}

function getWhenType (when) {
  const now = Date.now();
  if (!when) { 
    // run it immediatly
    return {isCron: false, when: new Date()};
  } else if (typeof when.getMonth === 'function') {
    // its Date object
    return {isCron: true, when: when}
  } else if (Number.isInteger(when)) {
    // its epoch value
    return { isCron: true , when: new Date(when)}
  } else if (typeof when === 'string') {
    const val = filterInt(when);
    if (Number.isInteger(val)) {
      // string of numbers
      return {isCron: true , when: val}
    } else {
      // may be cron, TODO validate it
      return {isCron: true, when: when}
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

module.exports.Task = Task
