const express = require('express');
const router = express.Router();
const path = require('path');

function getRouter (wot, options) {
  const controller = require(
    path.resolve(__dirname, './controllers/express.js')
  )(wot);

  const views = require(
    path.resolve(__dirname, './views.js')
  )(wot);

  router.get('/api/tasks', controller.list);
  //router.get('/tasks', views.tasks);
  router.get('/:file', views.staticFiles);
  return router;
}

module.exports = {
  expressAdapter: {getRouter}
};
