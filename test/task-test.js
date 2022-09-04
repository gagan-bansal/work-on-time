const t = require('tap');
const uuid = require('uuid');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { isClass } = require('./helper.js');
const {Task} = require('../lib/task.js');
const {MongoStore} = require('../lib/mongo-store.js');
t.before(async () => {
  t.context.worker = {
    name: 'mailer',
    worker: function () {
      return new Promise(() => {});
    }
  }
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  t.context.mongod = mongod;
  t.context.store = new MongoStore({
    uri: uri
  })
  await t.context.store.init();
})
t.ok(isClass(Task), 'exported Class')
t.type(Task.createTask, 'function', 'has static method createTask');

t.test('Create new instance', async (t) => {
  const task = new Task({
    data: {foo: 'bar', baz: {quax: 1}},
    when: 123
  }, t.context.worker, t.context.store);
  t.ok(task instanceof Task, 'Instance created');
  t.ok(uuid.validate(task.uuid), 'instance has uuid');
  t.type(task.save, 'function', 'has method save');
  t.type(task.toPlainObject, 'function', 'has method plainObject');
  const plain = task.toPlainObject()
  t.ok(uuid.validate(task.uuid), 'plain object had uuid');
  t.ok(plain.status.created, 'plain object has status created');
  delete plain.uuid;
  delete plain.status.created;
  t.same(plain,
    {
      worker: 'mailer',
      data: { foo: 'bar', baz: { quax: 1 } },
      when: 123,
      isCron: true,
      isSourceCron: false,
      storeResult: false,
      persistTaskStatus: true,
      persistCronStatus: true,
      parentTask: false,
      isActive: true,
      status: {  }
    }, 'convert to plain object');
})

t.test('Recreate instance', async (t) => {
  const task = new Task({
    data: {foo: 'bar', baz: {quax: 1}},
    when: 123
  }, t.context.worker, t.context.store);
  const plain = task.toPlainObject()
  const task2 = Task.createTask(plain, t.context.worker, t.context.store);

  t.ok(task instanceof Task, 'Instance recreated');
  t.ok(task.uuid, 'has uuid');
  t.type(task.save, 'function', 'has method save');
  t.type(task.toPlainObject, 'function', 'has method plainObject');

  t.same(task.toPlainObject(), plain, 'same as original instance');
})

t.test('Test task methods', async (t) => {
  const task = new Task({
    data: {foo: 'bar', baz: {quax: 1}},
    when: 123
  }, t.context.worker, t.context.store);
  t.ok(task.shouldProcess(), 'should process return true');
  task.status.started = Date.now()
  t.notOk(task.shouldProcess(), 'should process return false');
})

t.teardown(async () => {
  await t.context.store.close();
  await t.context.mongod.stop();
})
