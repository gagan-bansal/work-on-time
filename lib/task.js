const { v4: uuidv4 } = require('uuid');
const { EventEmitter } = require('events');
const { isValidCron } = require('cron-validator'); 
const notEmpty = require('./not-empty.js')

class Task extends EventEmitter {
  constructor (taskOptions = {}, worker, store, nowThreshold = 1000 ) {
    super();
    if (!worker || !store) throw new Error('Insufficient parameters');
    this.uuid = uuidv4();
    this.store = store;
    this.worker = worker;
    this.data = taskOptions.data || null;
    this.nowThreshold = nowThreshold;
    const {isCron, when, isRepetitive} = getWhenType(taskOptions.when, nowThreshold);
    this.when = when;
    this.isCron = isCron;
    this.isRepetitive = isRepetitive || false;
    this.isSourceCron = taskOptions.isSourceCron || false;
    this.storeResult = taskOptions.storeResult ??
      worker.storeResult ?? false;
    this.persistTaskStatus = taskOptions.persistTaskStatus ??
      worker.persistTaskStatus ?? true;
    this.parentTask = taskOptions.parentTask || false;
    this.isActive = taskOptions.isActive || true; // TODO remove it
    this.status = {
      created: Date.now()
    };
  }

  static createTask (data, worker, store) {
    if (!data || !worker || !store) throw new Error('missing paramters');
    const task = new Task(data, worker, store);
    // Object.assign(task, data);
    // TODO what is the elegent way to do the next line
    // task.worker = worker;
    task.uuid = data.uuid;
    return task;
  }

  save (result) {
    const task = this;
    let persist = this.isRepetitive || this.persistTaskStatus;
    if (this.storeResult && notEmpty(result)) {
      persist = true;
      this.result = result;
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
      worker: this.worker.name,
      data: this.data,
      when: typeof(this.when) === 'string'
        ? this.when : this.when.valueOf(),
      isCron: this.isCron,
      isSourceCron: this.isSourceCron || false,
      storeResult: this.storeResult,
      persistTaskStatus: this.persistTaskStatus,
      parentTask: this.parentTask,
      isActive: this.isActive,
      status: this.status
    };
    if (this.result) data.result = this.result;
    if (this.error) data.error = this.error; // TODO with serialize error
    return data;
  }

  async spinCronTask () {
    const taskData = this.toPlainObject();
    delete taskData.when;
    taskData.isCron = false;
    taskData.isRepetitive = false;
    taskData.isSourceCron = true;
    taskData.parentTask = taskData.uuid;
    const spinned = new Task(taskData, this.worker, this.store);
    await spinned.save();
    return Promise.resolve(spinned);
  }

  shouldProcess () {
    const stts = this.status;
    return !stts.started && !stts.completed && !stts.failed
      && !stts.paused && !stts.stopped && !stts.deleted;
  }

  isOld () {
    if (this.isCron && !this.isRepetitive) {
      return this.when.valueOf() < Date.now();
    } else {
      return false;
    }
  }
}

function getWhenType (when, nowThreshold) {
  if (!when) {
    // run it immediatly
    return {isCron: false, when: new Date(Date.now() + nowThreshold)};
  } else if (typeof when.getMonth === 'function') {
    // its Date object
    return {isCron: true, when: when}
  } else if (Number.isInteger(when)) {
    // its epoch value
    return { isCron: true , when: new Date(when)}
  } else if (typeof when === 'string') {
    let val = filterInt(when);
    if (Number.isInteger(val)) {
      // string of numbers
      return {isCron: true , when: new Date(val)}
    } else if (
      isValidCron(
        when, {
          seconds: true,
          alias: true,
          allowBlankDay: true
        }
      )
    ) {
      // valid cron string
      return {isCron: true, when: when, isRepetitive: true}
    } else if (!isNaN(Date.parse(when))) {
      // valid js date string
      val = Date.parse(when);
      return {isCron: true, when: new Date(val)};
    } else {
      throw new Error("Invalid 'when' value: " + when);
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

module.exports.Task = Task;
