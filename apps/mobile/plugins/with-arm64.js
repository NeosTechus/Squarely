// Config plugin: limit the Android build to arm64-v8a so the APK doesn't ship
// native libraries for armeabi-v7a/x86/x86_64. arm64 covers essentially all
// modern Android phones and tablets; this roughly halves the universal APK.
const { withGradleProperties } = require("expo/config-plugins");

module.exports = function withArm64(config) {
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
    const key = "reactNativeArchitectures";
    const entry = { type: "property", key, value: "arm64-v8a" };
    const i = props.findIndex((p) => p.type === "property" && p.key === key);
    if (i >= 0) props[i] = entry;
    else props.push(entry);
    return cfg;
  });
};
