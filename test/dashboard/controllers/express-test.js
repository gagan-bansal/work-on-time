const t = require('tap');
const { MongoMemoryServer } = require('mongodb-memory-server');
const sinon = require('sinon');
const { isClass } = require(process.cwd() + '/test/helper.js');
const {WorkOnTime} = require(process.cwd() + '/lib/work-on-time.js');
const {MongoStore} = require(process.cwd() + '/lib/mongo-store.js');
const express = require('express');
const bodyParser = require('body-parser');
const request = require('supertest');

const expressController = require(process.cwd() + '/dashboard/controllers/express.js');

t.beforeEach(async t => {
  // initiate mongo
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  t.context.mongod = mongod;
  t.context.uri = uri;

  // initiate WorkOnTime
  const wot = new WorkOnTime({
    mongoUri: t.context.uri, db: 'workOnTime'
  })
  await wot.init();
  await wot.start();
  wot.defineWorker({
    name: 'foo',
    handler: () => Promise.resolve({count: 20})
  });
  t.context.wot = wot;

  // initiate controller
  const expCtrl = expressController(t.context.wot);
  t.context.expCtrl = expCtrl;

  // initiate express server
  const app = express();
  app.use(bodyParser.json());

  // initiate routes
  app.get('/health', expCtrl.health);
  app.post('/tasks', expCtrl.create);
  app.get('/tasks', expCtrl.list);
  t.context.expServer = await app.listen();
  t.context.app = app;
});

t.afterEach(async t => {
  t.context.expServer.close(async () => {
    await t.context.wot.store.close();
    await t.context.mongod.stop();
    t.end();
  });
});

t.test('Controller methods', async t => {
  await request(t.context.app)
    .post('/tasks')
    .send({worker: 'foo'})
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/)
    .expect(200)
  t.ok(1, 'create: task created');

  await request(t.context.app)
    .get('/tasks')
    .expect('Content-Type', /json/)
    .expect(200)
    .then(resp => {
      t.equal(resp.body.length, 1, "list: got tasks' list");
    })
});
