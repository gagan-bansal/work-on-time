const t = require('tap');
const { MongoMemoryServer } = require('mongodb-memory-server');
const MockDate = require('mockdate');
const clone = require('clone');
const {MongoStore} = require('../lib/mongo-store.js');
const {Task} = require('../lib/task.js');

t.beforeEach(async t => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  t.context.mongod = mongod
  t.context.uri = uri;
  const store = new MongoStore({
    uri: t.context.uri
  })
  const storeInit = await store.init();
  t.context.store = store;
  t.context.worker = {
    name: 'mailer',
    worker: function () {
      return new Promise(() => {});
    }
  }

  MockDate.set(111);
  const task = new Task({
    data: 'foo',
    when: 123
  }, t.context.worker, t.context.store);
  //await task.save();
  t.context.task = task;

  t.context.plainTaskData = {
    worker: 'mailer',
    data: 'foo',
    when: 123,
    isCron: true,
    isSourceCron: false,
    storeResult: false,
    persistCronStatus: true,
    persistTaskStatus: true,
    parentTask: false,
    isActive: true,
    status: { created: 111 }
  };
})

t.afterEach(async t => {
  await t.context.store.close();
  await t.context.mongod.stop();
})

// test addTask method
t.todo('addTask method', async t => {
  const store = t.context.store;
  t.ok(typeof store.addTask === 'function', 'has function addTask');
  await t.resolves(store.addTask({
    uuid: 0,
    data: 'foo',
    when: 123
  }, t.context.worker), 'add task data to store');

  const task = await store.addTask({
    uuid: 1,
    data: 'foo',
    when: 123
  }, t.context.worker);

  t.ok(task instanceof Task,
    'added task data that returns an instance of Task');
  t.ok(task.uuid, 'task has uuid');
  t.todo('verify uuid');
  const plainObj = clone(t.context.plainTaskData);
  plainObj.uuid = task.uuid;
  t.same(task.toPlainObject(), plainObj,
    'added task data with expected values');
  let tasksCount = await store.collection.count();
  t.equal(tasksCount, 2, 'matched the count of tasks in db');
});

// test getTask method
t.test('getTask method', async t => {
  const store = t.context.store;
  await t.context.task.save();
  t.ok(typeof store.getTask === 'function', 'has function getTask');
  const getTaskVal = await store.getTask(t.context.task.uuid);
  delete getTaskVal._id;
  delete getTaskVal.uuid;
  t.same(getTaskVal, t.context.plainTaskData, 'getTask returns plain object');
})

// test save method
t.test('save method', async t => {
  const store = t.context.store;
  t.ok(typeof store.save === 'function', 'has function save');
  t.context.plainTaskData.status.addedToQueue = 112
  t.resolves(store.save(t.context.task.uuid, t.context.plainTaskData), 'resolves');
  const updatedTaskData = await store.save(t.context.task.uuid,
    t.context.plainTaskData);
  delete updatedTaskData._id;
  delete updatedTaskData.uuid;
  t.same(updatedTaskData, t.context.plainTaskData, 'save/update the task data match');
});

// add cron task
t.skip('add cron pattern task', async t => {
  const store = t.context.store;
  const cronTask = await store.addTask({
    data: 'foo',
    when: '5 4 * * *'
  }, t.context.worker);

  t.equal(cronTask.toPlainObject().when, '5 4 * * *',
    'added cron task data with cron pattern');
});

// test getCronTasks
t.test('getCronTasks', async t => {
  const store = t.context.store;
  const cronTask = new Task({
    data: 'foo',
    when: '5 4 * * *'
  }, t.context.worker, store);
  await cronTask.save();
  t.ok(typeof store.getCronTasks === 'function', 'has function getCronTask');
  t.resolves(store.getCronTasks(), 'getCronTasks promise resolves');
  const cronTasks = await store.getCronTasks();
  t.equal(cronTasks.length, 1, 'getCronTasks resolves to correct count');
  const incompleteTasks = await store.getIncompleteTasks();
  t.equal(incompleteTasks.length, 0, 'getIncompleteTasks resolves to correct count');
});

// test patchTask
t.todo('patchTask');

// test incompletTasks
t.test('getIncompleteTasks', async t => {
  const store = t.context.store;
  t.resolves(store.getIncompleteTasks(),
    'getIncompleteTasks promise resolves before adding tasks');
  const task = new Task({
    data: 'foo',
  }, t.context.worker, store);
  await task.save();
  t.ok(typeof store.getIncompleteTasks === 'function', 'has function getIncompleteTask');
  t.resolves(store.getIncompleteTasks(), 'getIncompleteTasks promise resolves');
  const incompleteTasks = await store.getIncompleteTasks();
  t.equal(incompleteTasks.length, 1, 'getIncompleteTasks resolves to correct count');
  const cronTasks = await store.getCronTasks();
  t.equal(cronTasks.length, 0, 'getCronTasks resolves to correct count');
});

t.test('getTasks', async t => {
  const store = t.context.store;
  //save task
  await t.context.task.save();
  // saving another task
  const task = new Task({
    data: 'foo',
  }, t.context.worker, store);
  await task.save();
  t.ok(typeof store.getTasks === 'function', 'has function getTasks');
  const tasks = await store.getTasks();
  t.equal(tasks.length, 2, 'getTasks resolves to correct count');
});

