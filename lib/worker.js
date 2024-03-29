const extend = require('extend');
const {default: PQueue} = require('p-queue');
const {classToPlain} = require('class-transformer');
const {EventEmitter} = require('events');

class Worker extends EventEmitter {
  constructor (options = {}) {
    super();
    const {
      name, handler, priority = 0,
      concurrency = 10, intervalCap = Infinity, interval = 0,
      storeResult = false, persistTaskStatus = true
    } = options;
    if (!name) throw new Error('Porperty missing: name');
    if (!handler) throw new Error("Property missing: handler, a worker's handler function")

    extend(this, {
      name, handler,
      storeResult, persistTaskStatus,
      _queue: new PQueue({concurrency, intervalCap, interval, priority})
    })
  }

  toPlainObject () {
    return classToPlain(this, {excludePrefixes: ["_", "handler"]});
  }

}

module.exports = {Worker};
