const express = require('express');
const path = require('path');
const app = express();
const port = 3000;
const dummyWot = require('./dummy-wot.js');
const {ExpressAdapter} = require('./index.js');
if (process.env.NODE_ENV === 'development') {
  // from https://bytearcher.com/articles/refresh-changes-browser-express-livereload-nodemon/
  const livereload = require('livereload');
  const connectLivereload = require("connect-livereload");
  const liveReloadServer = livereload.createServer();
  liveReloadServer.watch(path.join(__dirname, 'dashboard'));

  app.use(connectLivereload({}));
  liveReloadServer.server.once("connection", () => {
    setTimeout(() => {
      console.log('reloading...');
      liveReloadServer.refresh("/");
    }, 100);
  });
}

app.use((req, res, next) => {
  console.log('url: ', req.url);
  next();
});

app.get('/', (req, res) => {
  res.send('Hello World!')
});

(async () => {
  const wot = await dummyWot();
  //app.use(express.static('dist', {})); // TODO how to handle this
  // mount dashboard router
  const expressAdapter = new ExpressAdapter(wot);
  const dashRouter = expressAdapter.getRouter();
  app.use('/wot-dash', dashRouter);
  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
  });
})();
