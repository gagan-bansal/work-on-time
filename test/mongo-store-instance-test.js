const t = require('tap');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { isClass } = require('./helper.js');
const {MongoStore} = require('../lib/mongo-store.js');

t.beforeEach(async t => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  t.context.mongod = mongod
  t.context.uri = uri;
})

t.afterEach(async t => {
  return t.context.mongod.stop();
})

t.test('Class/instance', async t => {
  t.ok(isClass(MongoStore), 'Exported Class');
  const store = new MongoStore({
    uri: t.context.uri
  })
  t.ok(store instanceof MongoStore, 'Instance created');
  t.equal(store.uri, t.context.uri, 'with correct uri');
  t.equal(store.dbName, 'workOnTime', 'with correct dbName');
  t.equal(store.collectionName, 'tasks', 'with correct collection name');
  t.notOk(store.collection, 'does not have mongo collection');
  const storeInit = await store.init();
  t.ok(store.collection, 'has mongo collection');
  t.todo('store.close');
  await store.close();
})
