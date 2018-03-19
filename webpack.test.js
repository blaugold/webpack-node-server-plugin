const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');
const WebpackMochaPlugin = require('webpack-mocha-plugin');
const path = require('path');

module.exports = {
    target: 'node',

    entry: {
        test: './test.bundle.ts'
    },

    output: {
        path: path.resolve('.tmp/test'),
        filename: '[name].bundle.js'
    },

    resolve: {
        extensions: ['.js', '.ts']
    },

    devtool: 'inline-source-map',

    externals: [nodeExternals()],

    module: {
        rules: [
            {
                test: /\.ts$/,
                loader: 'awesome-typescript-loader'
            },
            {
                enforce: 'post',
                test: /\.(js|ts)$/,
                loader: 'sourcemap-istanbul-instrumenter-loader',
                exclude: /\.(spec).(js|ts)/,
                query: {
                    'force-sourcemap': true
                }
            }
        ]
    },

    plugins: [
        new webpack.BannerPlugin({
            banner: 'require("source-map-support").install();',
            raw: true,
            entryOnly: true
        }),
        new WebpackMochaPlugin({
            codeCoverage: true
        })
    ]
};