module.exports = function (wot, options) {
  if (!wot) throw new Error('WorkOnTime instance not provided')
  return {
    health: async function (req, res) {
      console.log('I am fine');
      res.status(200).json({message: 'OK'});
    },

    create: async function (req, res) {
      console.log('create called');
      if (!req.body.job) {
        return res.status(422).json({message: 'Paramter missing: job'});
      }
      try {
        await wot.addTask(req.body);
      } catch (error) {
        return res.status(500).json({message: error.message})
      }
      res.status(200).json({message: 'Job created'})
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
      const resp = await wot.stopTask(uuid)
        .catch(err => {
          if (/^Task not running/i.test(err.message)) {
            res.status(400).json({message: 'Task not running: ' + uuid});
          } else {
            res.status(500).json({message: err.message});
          }
        });
      res.status(200).json(resp);
    }
  }
};

