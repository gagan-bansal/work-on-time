const t = require('tap');
const { MongoMemoryServer } = require('mongodb-memory-server');
const sinon = require('sinon');
const { isClass } = require('./helper.js');
const {WorkOnTime} = require('../lib/work-on-time.js');
const {MongoStore} = require('../lib/mongo-store.js');

t.beforeEach(async t => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  t.context.mongod = mongod
  t.context.uri = uri;
  sinon.spy(MongoStore.prototype, 'init');
  sinon.spy(WorkOnTime.prototype, '_start');
})

t.afterEach(async t => {
  MongoStore.prototype.init.restore();
  WorkOnTime.prototype._start.restore();
  return t.context.mongod.stop();
})

t.test('Class/instance', async t => {
  t.ok(isClass(WorkOnTime), 'Exported Class');
  const wot = new WorkOnTime({
    mongoUri: t.context.uri
  })
  t.ok(wot instanceof WorkOnTime, 'Instance created');
  t.same(wot.workers, {}, 'has property workers');
  t.ok(wot.store instanceof MongoStore, 'has mongo store');

  t.todo('onStart');
  t.todo('onFail');
  t.equal(wot.setIntervalId, undefined, 'has property setIntervalId');
  t.ok(wot.runInterval, 'has property run interval');

  t.same(wot._jobsInQueue, {}, 'has property _jobsInQueue');
  t.same(wot.crons, {}, 'has prorty crons');
  t.ok(typeof wot.nowThreshold === 'number', 'has nowThreshold');
  t.equal(wot._started, false, 'has property _started');
  t.equal(wot._initiated, false, 'has property _initiated');
  t.todo('wot.close');

  await t.resolves(wot.init(), 'Instance initiated');
  t.ok(wot.store.init.called, 'init method calls store.init');
  await wot.store.close();
});

