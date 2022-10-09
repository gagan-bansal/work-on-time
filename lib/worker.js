const extend = require('extend');
const {default: PQueue} = require('p-queue');

const {EventEmitter} = require('events');

class Worker extends EventEmitter {
  constructor (options = {}) {
    super();
    const {
      name, handler, priority = 0,
      concurrency = 10, intervalCap = Infinity, interval = 0,
      storeResult = false, persistTaskStatus = true, persistCronStatus = true
    } = options;
    if (!name) throw new Error('Porperty missing: name');
    if (!handler) throw new Error("Property missing: handler, a worker's handler function")

    extend(this, {
      name, handler,
      storeResult, persistTaskStatus,
      persistCronStatus,
      queue: new PQueue({concurrency, intervalCap, interval, priority})
    })
  }
}

module.exports = {Worker};
