const express = require('express');
const path = require('path');
const app = express();
const port = 3000;
const demoWot = require('./demo-wot.js');
const {ExpressAdapter} = require('../index.js');
if (process.env.NODE_ENV === 'development') {
  // from https://bytearcher.com/articles/refresh-changes-browser-express-livereload-nodemon/
  const livereload = require('livereload');
  const connectLivereload = require("connect-livereload");
  const liveReloadServer = livereload.createServer();
  liveReloadServer.watch(path.join(__dirname, 'dashboard'));

  app.use(connectLivereload({}));
  liveReloadServer.server.once("connection", () => {
    setTimeout(() => {
      console.log('[demo-server] reloading...');
      liveReloadServer.refresh("/");
    }, 100);
  });
}

app.use((req, res, next) => {
  console.log('[demo-server] url: ', req.url);
  next();
});

app.get('/', (req, res) => {
  res.send(`
    <p> work-on-time demo</p>
    <a href="/demo/scheduled-tasks">Scheduled Tasks</a><br>
    <a href="/demo/tasks">All Tasks</a>
  `);
});

(async () => {
  const wot = await demoWot();
  // mount dashboard router
  const expressAdapter = new ExpressAdapter(wot);
  const dashRouter = expressAdapter.getRouter();
  app.use('/demo', dashRouter);
  app.listen(port, () => {
    console.log(`[demo-server] Demo app listening on port ${port}`)
  });
})();
