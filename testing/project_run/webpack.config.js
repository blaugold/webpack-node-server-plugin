const path = require('path');
const NodeServerPlugin = require('webpack-node-server-plugin').NodeServerPlugin;

module.exports = {

  mode: 'production',

  target: 'node',
  entry: './server.js',

  resolve: {
    extensions: ['.js']
  },

  output: {
    path: path.resolve('.tmp/dev'),
    filename: '[name].bundle.js'
  },

  plugins: [
    new NodeServerPlugin({
      commandArgs: ['--inspect'],
      command: 'node'
    })
  ]

};
