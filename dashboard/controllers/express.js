module.exports = function (wot, options) {
  if (!wot) throw new Error('WorkOnTime instance not provided')
  return {
    health: async function (req, res) {
      console.log('I am fine');
      res.status(200).json({message: 'OK'});
    },

    create: async function (req, res) {
      console.log('body: ', JSON.stringify(req.body));
      if (!req.body.job) {
        return res.status(422).json({message: 'Paramter missing: job'});
      }
      try {
        await wot.addTask(req.body);
        res.status(200).json({message: 'Job created'})
      } catch (error) {
        return res.status(500).json({message: error.message})
      }
    },

    list: async function (req, res) {
      const opts = req.params.job ? {job: req.params.job} : {}
      wot.getTasks(opts)
      .then(tasks => {
        res.status(200).json({data: tasks})
      })
      .catch(err => {
        res.status(500).json({message: 'Internal Server Error'})
      })
    },

    stop: async function (req, res) {
      const uuid = req.params.uuid;
      try {
        const resp = await wot.stopTask(uuid);
        res.status(200).json(resp);
      } catch(err) {
        if (err.statusCode === 404) {
          res.status(404).json({message: 'No task: ' + uuid});
        } else {
          res.status(500).json({message: err.message});
        }
      };
    },

    restart: async function (req, res) {
      const uuid = req.params.uuid;
      try {
        const resp = await wot.restartTask(uuid);
        res.status(200).json(resp);
      } catch(err) {
        if (err.statusCode === 404) {
          res.status(404).json({message: 'No task: ' + uuid});
        } else {
          res.status(500).json({message: err.message});
        }
      };
    },

    cronList: async function (req, res) {
      const opts = req.params.job ? {job: req.params.job} : {}
      try {
        const tasks = await wot.getCronTasks(opts)
        res.status(200).json({data: tasks})
      } catch(err) {
        res.status(500).json({message: 'Internal Server Error'})
      }
    }
  }
};

