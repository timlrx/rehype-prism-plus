// vite.config.js
const path = require('path')

module.exports = {
  build: {
    lib: {
      entry: path.resolve(__dirname, 'index.js'),
      name: 'rehype-prism-plus'
    },
    // do not empty output directory as it contains typescript declarations.
    emptyOutDir: false,
  }
}