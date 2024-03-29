const express = require('express');
const router = express.Router();
const path = require('path');

const expController = require('./controllers/express.js');
const expViews = require('./views.js');

class ExpressAdapter {

  constructor (wot, options) {
    this.wot = wot;
    this.options = options
  }

  getRouter () {
    router.use(express.json());
    router.use(express.urlencoded({extended: true}));
    // TODO load initially contorllers and views file
    const controller = expController(this.wot);

    const views = expViews(this.wot);

    router.get('/api/tasks?', controller.list);
    router.post('/api/tasks?', controller.create);
    //router.delete('/api/tasks?/:uuid', controller.delete);
    router.delete('/api/tasks?/:uuid',
      (req, res) => res.status(404).json({message: 'TODO'}));
    router.put('/api/tasks?/stop/:uuid', controller.stop);
    router.put('/api/tasks?/restart/:uuid', controller.restart);
    router.get('/api/scheduled-tasks', controller.cronList);
    router.get('/api/workers', controller.workersList);
    // for html views, js and css files
    router.get('/:file', views.staticFiles);
    return router;
  }
}

module.exports = {
  ExpressAdapter
};
