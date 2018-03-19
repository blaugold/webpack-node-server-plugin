
const NodeServerPlugin = require('../../release').NodeServerPlugin;

module.exports = {
    target: 'node',
    entry: './server.js',

    resolve: {
        extensions: ['.js']
    },

    output: {
        path: '.tmp/dev',
        filename: '[name].bundle.js'
    },

    plugins: [
        new NodeServerPlugin({
          commandArgs: ['--inspect'],
          command: 'node'
        })
    ]
};