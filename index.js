const path = require('path');

module.exports = {
  ...require(path.resolve(__dirname,'./lib/work-on-time.js')),
  ...require(path.resolve(__dirname,'./lib/worker.js')),
  ...require(path.resolve(__dirname,'./dashboard/routes.js')),
};

