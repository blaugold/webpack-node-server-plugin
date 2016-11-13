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

## Options
```
new WebpackNodeServerPlugin({
    retries?: number = 3;
    retryDelay?: number = 1;
    minUpTime?: number = 10;
    compilationDebounce?: number = 300;
})
```

`retries` number of times script is restarted if exit code is not 0.
`retryDelay` delay in seconds between script exiting and restarting it.
`minUpTime` seconds script has to stay up before retry counter is reset.
`compilationDebounce` milli seconds by which compilation events are debounced.