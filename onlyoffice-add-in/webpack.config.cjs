const path = require("path");
const webpack = require("webpack");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

const wordSource = path.resolve(__dirname, "../word-add-in/add-in/src");
const wordShared = path.resolve(__dirname, "../word-add-in/shared");

module.exports = {
  entry: "./src/index.tsx",
  output: {
    path: path.resolve(__dirname, "plugin"),
    filename: "plugin.bundle.js",
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
    modules: [path.resolve(__dirname, "node_modules"), "node_modules"],
  },
  plugins: [
    new MiniCssExtractPlugin({ filename: "plugin.css" }),
    new webpack.NormalModuleReplacementPlugin(
      /office[\\/]document$/,
      path.resolve(__dirname, "src/onlyoffice/document.ts")
    ),
    new webpack.NormalModuleReplacementPlugin(
      /hooks[\\/]useWordSelection$/,
      path.resolve(__dirname, "src/onlyoffice/useWordSelection.ts")
    ),
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        include: [path.resolve(__dirname, "src"), wordSource, wordShared],
        loader: "ts-loader",
        options: { configFile: "tsconfig.json", transpileOnly: true },
      },
      {
        test: /\.css$/,
        include: [path.resolve(__dirname, "src"), wordSource],
        use: [MiniCssExtractPlugin.loader, "css-loader", "postcss-loader"],
      },
    ],
  },
  devtool: "source-map",
  performance: { hints: false },
};
