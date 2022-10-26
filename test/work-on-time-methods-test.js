const t = require('tap');
const { MongoMemoryServer } = require('mongodb-memory-server');
const sinon = require('sinon');
const { isClass } = require('./helper.js');
const {WorkOnTime} = require('../lib/work-on-time.js');

t.beforeEach(async t => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  t.context.mongod = mongod
  t.context.uri = uri;
  const wot = new WorkOnTime({
    mongoUri: t.context.uri
  })
  await wot.init();
  sinon.spy(wot);
  t.context.wot = wot;
})

t.afterEach(async t => {
  await t.context.wot.store.close();
  return t.context.mongod.stop();
})

t.test('Class/instance', async t => {
  const wot = t.context.wot;
  t.ok(isClass(WorkOnTime), 'Exported Class');
  t.ok(wot instanceof WorkOnTime, 'Instance created');
  t.todo('wot.close');
})

t.todo('restart');

t.test('start', async t => {
  const wot = t.context.wot;
  t.equal(wot._started, false, 'on init not started the wot');
  await t.context.wot.start();
  t.equal(wot._started, true, 'started the wot');
  t.ok(wot._loadCronTasks.called, '_loadCronTasks called');
  t.ok(wot._loadScheduledTasks.called, '_loadScheduledTasks called');
  await t.rejects(t.context.wot.start(), 'reject if system is already up');
})

t.todo('stop');

t.test('defineWorker', async t => {
  const wot = t.context.wot
  t.doesNotThrow(() => {
    return wot.defineWorker({
      name: 'foo',
      handler: () => true
    });
  }, 'Worker defined');
  t.todo('name missing throws error');
  t.todo('worker missing throws error');
})
