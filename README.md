# work-on-time

Simple job scheduler, that reports task status started, failed, completed or stopped.

## Installation

```
npm install work-on-time
```

## Usage

Basic approach is you define a worker. Worker is a object with worker name and handler function that would be run when a task is added for that worker.

Then you add a task for that worker. Task is object with worker name, data to be passed to handler and 'when' parameter when do you want to execute the task.

Here is a simple usage:

```js
// import required classes
const {WorkOnTime, Worker, MongoStore } = require('../index.js');
// initiate WorkOnTime
const wot = new WorkOnTime({
  mongoUri: uri
});
await wot.init();

await wot.start();

// teaMaker example
const teaMaker = new Worker({
  name: 'teaMaker',
  handler: async (data) => {
    await delay(5 * 1000); // 5 secs
    return Promise.resolve({cups: data.cups});
  }
});

// add event lister on worker
teaMaker.on('complete', (result)=> {
  console.log(`Served ${result.cups} cups of tea.`);
});

wot.addWorker(teaMaker);

// add task
const teaTask = await wot.addTask({
  worker: 'teaMaker',
  when: '0 6 * * *',
  data: {
    cups: 1
  }
});

// add event listener on task
teaTask.on('complete', (result)=> {
  console.log(`Served ${result.cups} cups of tea.`);
});

```

## Demo

There is a simple demo using `work-on-time` lib. `./demo` folder contains `demo-server.js` a express server that uses express adapter for `work-on-time`. And there is `demo-wot.js` file containing many examples of workers and tasks. To run:

```sh
npm run demo
```

This serve on port 3000 (http://127.0.0.1:3000/)

## API
  TODO

