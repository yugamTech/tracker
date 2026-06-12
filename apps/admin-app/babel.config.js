module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo (SDK 54) automatically applies the react-native-worklets
    // (reanimated) and expo-router transforms — no manual plugins required.
    presets: ['babel-preset-expo'],
  };
};
