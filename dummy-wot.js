const { MongoMemoryServer } = require('mongodb-memory-server');
const {WorkOnTime, Worker, MongoStore } = require('./index.js');
const express = require('express');
const bodyParser = require('body-parser');
const request = require('supertest');
const delay = require('delay');

module.exports = async function () {
  // initiate mongo
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  // initiate WorkOnTime
  const wot = new WorkOnTime({
    mongoUri: uri
  })
  await wot.init();
  await wot._start();
  const barWorker = new Worker({
    name: 'bar',
    handler: async () => {
      await delay(30 * 1000); // 30 secs
      Promise.resolve({count: 20})
    }
  });
  barWorker.on('complete', ()=> {
    console.log('Hey bar job is over');
  });
  wot.addWorker(barWorker);

  const fooWorker = new Worker({
    name: 'foo',
    handler: async () => Promise.resolve({count: 20}),
    storeResult: true
  });
  fooWorker.on('start', (task) => {
    console.log('foo started with id: ', task.data.id);
  });
  wot.addWorker(fooWorker);

  const fooErrorWorker = new Worker({
    name: 'fooError',
    handler: async () => {
      return Promise.reject(new Error('I am not functional.'));
    }
  });
  fooErrorWorker.on('fail', () => console.log("I'll fail."));
  wot.addWorker(fooErrorWorker);

  const cronWorker = new Worker({
    name: 'fooCron',
    handler: async (data) => {
      console.log(Date.now() + ': I am cron' + data);
    }
  });
  wot.addWorker(cronWorker);

  await wot.addTask({job: 'foo', data: {id: '123'}});
  await wot.addTask({job: 'fooError'});
  await wot.addTask({job: 'bar'});
  await wot.addTask({job: 'fooCron', when: '*/10 * * * * *'});
  await wot.addTask({job: 'fooCron', when: '*/1 * * * * *', data: 'id 20 '});
  return Promise.resolve(wot);
};

