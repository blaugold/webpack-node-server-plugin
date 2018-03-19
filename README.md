## Webpack Node Server Plugin
Webpack plugin which restarts node script with every compilation.

## Install
```bash
npm i -D webpack-node-server-plugin
```

## Usage

Import the plugin trough `import` syntax:

```javascript
import { NodeServerPlugin } from 'webpack-node-server-plugin'
```

Or through `require`:

```javascript
const NodeServerPlugin = require('webpack-node-server-plugin').NodeServerPlugin;
```

And add it to your webpack config:

```javascript
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
        new NodeServerPlugin()
    ]
}
```

Per default the first `entry` with the extension `.js` is used when starting the server.

## Config

Look at [`NodeServerPluginConfig`](src/config.ts) for config options.
