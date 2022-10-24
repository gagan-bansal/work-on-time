const path = require('path');
const distDir = '../dist';
const config = {
  root: path.resolve(__dirname, distDir),
  dotfiles: 'deny',
  headers: {
    'x-timestamp': Date.now(),
    'x-sent': true
  }
}
module.exports = function (options={}) {
  if (options.header) config.headers = options.headers;
  return {
    staticFiles: async function (req, res, next) {
      let file = req.params.file;
      const ext = path.extname(file);
      if (!ext) file += '.html';
      // console.log('serve file: %s, ext: %s', file, path.extname(file));
      res.sendFile(file, config, function (err) {
        if (err) {
          next()
          // console.error(err);
          // TODO trigger error event
        }
      })
    }
  }
};
