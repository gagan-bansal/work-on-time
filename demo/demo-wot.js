require('longjohn');
const { MongoMemoryServer } = require('mongodb-memory-server');
const {WorkOnTime, Worker, MongoStore } = require('../index.js');
const express = require('express');
const bodyParser = require('body-parser');
const request = require('supertest');
const delay = require('delay');

const dummyWot = async function dummyWot () {
  // initiate mongo
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  console.log('[demo-wot] Mongo instance created.');

  // initiate WorkOnTime
  const wot = new WorkOnTime({
    mongoUri: uri
  });
  await wot.init();
  console.log('[demo-wot] Wot initiated.');

  await wot.start();
  console.log('[demo-wot] Started wot.');

  // teaMaker example
  const teaMaker = new Worker({
    name: 'teaMaker',
    handler: async (data) => {
      console.log(`[teaMaker handler] will server ${data.cups} ☕ of tea after 5 sec`);
      await delay(5 * 1000); // 5 secs
      return Promise.resolve({cups: data.cups});
    },
    storeResult: true
  });

  teaMaker.on('complete', (result)=> {
    console.log(`[teaMaker: worker event 'complete'] Served ${result.cups} ☕ of tea.`);
  });

  wot.addWorker(teaMaker);

  const teaTask = await wot.addTask({
    worker: 'teaMaker',
    when: '*/30 * * * * *',
    data: {
      cups: 2
    }
  });

  teaTask.on('complete', (result)=> {
    console.log(`[teaMaker: task event 'complete'] Served ${result.cups} cups of tea.`);
  });

  console.log('[demo-wot] Added task for teaMaker.');

  // clock example
  const clock = new Worker({
    name: 'clock',
    handler: async (data) => {
      console.log(`[clock handler] ${data.sound} time: `, Date());
    },
    persistTaskStatus: false  // task status started/completed/failed
                              // will not be stored in DB
  });

  clock.on('start', () => {
    console.log("[clock: worker event 'start'] Clock started");
  });

  wot.addWorker(clock);

  const clockCronTask = await wot.addTask({
    worker: 'clock',
    when: '*/10 * * * * *',
    data: {
      sound: '🔔'
    }
  });

  // events on cron tasks
  clockCronTask.on('spin', clockTask => {
    clockTask.on('start', () => {
      console.log("[clock: task event 'start'] Clock started");
    });
  });
  console.log('[demo-wot] Added task for clock.');

  // task failed example
  const fooErrorWorker = new Worker({
    name: 'fooErrorWorker',
    handler: async () => {
      console.log("[fooErrorWorker: handler] ❌ I am not functional.");
      return Promise.reject(new Error('I am not functional.'));
    }
  });
  fooErrorWorker.on('fail', () => {
    console.log("[fooErrorWorker: worker event 'fail'] Oh! no.");
  });
  wot.addWorker(fooErrorWorker);

  await wot.addTask({
    worker: 'fooErrorWorker'
  });
  console.log('[demo-wot] Added task for fooErrorWorker.');

  // run task now
  const flash = new Worker({
    name: 'flash',
    handler: async () => {
      console.log('[flash: handler] ⚡⚡⚡');
      return Promise.resolve('⚡⚡⚡');
    },
    storeResult: true
  });

  wot.addWorker(flash);

  await wot.addTask({
    worker: 'flash'
  });
  console.log('[demo-wot] Added flash task.');

  // stop running task
  const lazyWorker = new Worker({
    name: 'lazy',
    handler: async (data, signal) => {
        console.log('[lazy: handler] Starting the lazy task');
      return new Promise((resovle, reject) => {
        const id = setInterval(() => {
          console.log('[lazy: handler] ' + "😴".repeat(parseInt(Math.random() * 10)));
        }, 2 * 1000);
        signal.addEventListener('abort', () => {
          console.log('[lazy: handler] Aborting lazy task...');
          clearInterval(id);
          reject(new Error('Aborted the lazy task'));
        });
      });
    }
  });

  lazyWorker.on('stop', () => {
    console.log("[lazy: worker event 'stop'] Worker: Stopped the lazy task");
  });

  wot.addWorker(lazyWorker);

  const lazyTask = await wot.addTask({worker: 'lazy'})
  lazyTask.on('stop', () => {
    console.log("[lazy: task event 'stop'] Task: Stopped the lazy task");
  });
  console.log('[demo-wot] Added lazy task.');

  setTimeout(() => {
    console.log('[demo-wot] Stopping lazy task...');
    wot.stopTask(lazyTask.uuid);
  }, 10 * 1000);

  return Promise.resolve(wot);
};

module.exports = dummyWot;
