const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');
const WebpackMochaPlugin = require('webpack-mocha-plugin');

module.exports = {
    target: 'node',

    entry: {
        test: './test.bundle.ts'
    },

    output: {
        path: '.tmp/test',
        filename: '[name].bundle.js'
    },

    resolve: {
        extensions: ['.js', '.ts']
    },

    devtool: 'inline-source-map',

    externals: [nodeExternals()],

    module: {
        loaders: [
            {
                test: /\.ts$/,
                enforce: 'pre',
                loader: 'tslint'
            },
            {
                test: /\.ts$/,
                loader: 'awesome-typescript'
            },
            {
                enforce: 'post',
                test: /\.(js|ts)$/,
                loader: 'sourcemap-istanbul-instrumenter',
                exclude: /\.(spec).(js|ts)/,
                query: {
                    'force-sourcemap': true
                }
            }
        ]
    },

    plugins: [
        new webpack.LoaderOptionsPlugin({
            options: {
                tslint: {
                    emitErrors: true,
                    failOnHint: true
                }
            }
        }),
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