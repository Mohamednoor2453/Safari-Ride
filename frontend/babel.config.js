// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // Remove "expo-router/babel" - it's deprecated for SDK 50+
      ["module:react-native-dotenv", {
        "moduleName": "@env",
        "path": ".env",
        "safe": false,
        "allowUndefined": true,
      }]
    ],
  };
};