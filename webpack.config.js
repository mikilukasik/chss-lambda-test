const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const ZipPlugin = require("zip-webpack-plugin");

module.exports = (env, argv) => {
  const { mode = "development" } = argv;
  let devtool = "inline-source-map";
  let outPath = path.resolve(__dirname, "dist");

  if (mode === "production") {
    console.log("creating production build");
    devtool = false;
  }

  const webpackConfig = [
    {
      entry: "./src/index.ts",
      mode,
      target: "node16",
      devtool,
      module: {
        rules: [
          {
            test: /\.ts$/,
            use: "ts-loader",
            exclude: [/node_modules/],
          },
        ],
      },
      resolve: {
        extensions: [".ts", ".js"],
        // fallback: {
        //   util: require.resolve("util/"),
        // },
      },
      output: {
        filename: "index.js",
        libraryTarget: "commonjs2",
        path: path.resolve(outPath, "smallPredict"),
      },
      plugins: [
        new CopyWebpackPlugin({
          patterns: [
            { from: "tf_loader", to: "." },
            { from: "tfjs_model", to: "." },
            // { from: "../package.json", to: "." },
          ],
        }),
        new ZipPlugin({
          filename: "lambda_small_predict.zip",
        }),
      ],
    },
  ];

  return webpackConfig;
};
