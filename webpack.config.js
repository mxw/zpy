let path = require('path');
let process = require('process');
let nodeExternals = require('webpack-node-externals');

let common = {
    mode: "production",
    devtool: "source-map",
    resolve: {
        extensions: [".ts", ".tsx"]
    },

    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: "ts-loader"
            },
            {
                enforce: "pre",
                test: /\.js$/,
                loader: "source-map-loader"
            }
        ]
    },

    resolve: {
        modules: [ "node_modules", path.resolve(process.env.NODE_PATH) ]
    },

    resolveLoader: {
        modules: [ "node_modules", path.resolve(process.env.NODE_PATH)]
    }
};

let frontend = Object.assign({
    entry: "./src/ui.tsx",
    externals: {
        "react": "React",
        "react-dom": "ReactDOM"
    },
    output: {
        path: path.resolve(__dirname, "./dist/ui")
    }
}, common);

let backend = Object.assign({
    entry: "./src/app.ts",
    target: "node",
    externals: [nodeExternals()],
    output: {
        path: path.resolve(__dirname, "./dist/app")
    }
}, common);

module.exports = [frontend, backend];
