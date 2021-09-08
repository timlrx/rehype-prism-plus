// vite.config.js
const path = require('path')

module.exports = {
  build: {
    lib: {
      entry: path.resolve(__dirname, 'index.js'),
      name: 'rehype-prism-plus',
      formats: ['es'],
    },
    // do not empty output directory as it contains typescript declarations.
    emptyOutDir: false,
  }
}