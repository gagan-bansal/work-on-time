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

t.test('_start', async t => {
  await t.rejects(t.context.wot._start(), 'reject if system is already up');
})

t.todo('stop');

t.test('defineJob', async t => {
  const wot = t.context.wot
  t.doesNotThrow(() => {
    return wot.defineJob({
      name: 'foo',
      worker: () => true
    });
  }, 'job defined');
  t.todo('name missing throws error');
  t.todo('worker missing throws error');
})
