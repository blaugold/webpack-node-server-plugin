## Webpack Node Server Plugin
Webpack plugin which restarts node script with every compilation.

## Install
```bash
npm i -D webpack-node-server-plugin
```

## Config
```javascript
const WebpackNodeServerPlugin = require('webpack-node-server-plugin')

module.exports = {
    target: 'node',
    entry: './server.js',
    output: {
        path: '.tmp/dev',
        filename: '[name].bundle.js'
    },
    resolve: {
        extensions: ['.js']
    },
    plugins: [
        new WebpackNodeServerPlugin()
    ]
}
```

## Config

Look at [`NodeServerPluginConfig`](src/config.ts) for config options.
