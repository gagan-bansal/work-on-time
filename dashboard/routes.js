const express = require('express');
const router = express.Router();
const path = require('path');

function getRouter (wot, options) {
  router.use(express.json());
  router.use(express.urlencoded({extended: true}));
  const controller = require(
    path.resolve(__dirname, './controllers/express.js')
  )(wot);

  const views = require(
    path.resolve(__dirname, './views.js')
  )(wot);

  router.get('/api/tasks', controller.list);
  router.post('/api/tasks', controller.create);
  router.put('/api/task/stop/:uuid', controller.stop);
  router.put('/api/task/restart/:uuid', controller.restart);
  router.get('/api/cron-tasks', controller.cronList);
  // for html views, js and css files
  router.get('/:file', views.staticFiles);
  return router;
}

module.exports = {
  expressAdapter: {getRouter}
};
