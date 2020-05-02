let path = require('path');
let process = require('process');
let externals = require('webpack-node-externals');

let resolve_path = (() => {
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

let common = {
  mode: "production",
  devtool: "source-map",

  resolve: {
    extensions: [".ts", ".tsx"],
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
    modules: resolve_path,
  },
  resolveLoader: {
    modules: resolve_path,
  },
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
  externals: [],
  output: {
    path: path.resolve(__dirname, "./dist/app")
  }
}, common);

module.exports = [frontend, backend];
