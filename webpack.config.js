const path = require('path');

module.exports = {
    mode: 'development',
    entry: './src/extension.ts',
    devtool: 'inline-source-map',
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    output: {
        path: path.resolve(__dirname, 'out'),
        filename: 'extension.js',
        libraryTarget: 'commonjs2',
        devtoolModuleFilenameTemplate: '../[resource-path]',
    },
    externals: {
        vscode: 'commonjs vscode', // The vscode-module is created on-the-fly and must be excluded.
    },
    target: 'node', // This makes sure not to bundle built-in modules like fs, path, etc.
};
