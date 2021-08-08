const path = require('path');
const process = require('process');
const externals = require('webpack-node-externals');

const TSConfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

const resolve_path = (() => {
  if (process.env.NODE_PATH === undefined) {
    return [
      'node_modules',
      path.resolve(__dirname, 'src'),
    ];
  } else {
    return [
      "node_modules",
      path.resolve(process.env.NODE_PATH),
      path.resolve(__dirname, 'src'),
    ];
  }
})();

const common = {
  devtool: "source-map",

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
      },
      {
        test: /\.s[ac]ss$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'sass-loader',
            options: {
              sassOptions: {
                includePaths: [path.resolve(__dirname, 'src/styles')]
              },
            },
          },
        ],
      },
    ],
  },

  resolve: {
    extensions: [".ts", ".tsx", ".js"],
    modules: resolve_path,
    fallback: {
      'assert': require.resolve('assert')
    },
  },
  resolveLoader: {
    modules: resolve_path,
  },
};

const frontend = {
  mode: "production",
  entry: "./src/ui.tsx",
  externals: {
    "react": "React",
    "react-dom": "ReactDOM"
  },
  output: {
    path: path.resolve(__dirname, "./dist/ui")
  },
  ...common
};

const backend = {
  mode: "production",
  entry: "./src/app.ts",
  target: "node",
  externals: [externals({
    modulesFromFile: true,
  })],
  output: {
    path: path.resolve(__dirname, "./dist/app")
  },
  ...common
};

const dev = {
  mode: "development",
  entry: "./src/app.ts",
  target: "node",
  externals: [externals({
    modulesFromFile: true,
  })],
  output: {
    path: path.resolve(__dirname, "./dist/dev")
  },
  ...common
};


module.exports = [frontend, backend, dev];
