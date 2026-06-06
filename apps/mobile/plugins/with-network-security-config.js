// Config plugin: installs cert-pinning/network_security_config.xml into the
// Android project's res/xml/ directory at prebuild time, and patches
// AndroidManifest's <application> tag with android:networkSecurityConfig so
// the OS enforces the pin set on outbound TLS.
//
// expo-build-properties does NOT have a networkSecurityConfig hook (verified
// against its TypeScript schema), so wiring this via that plugin is a silent
// no-op. This plugin does the work directly via withDangerousMod (file copy)
// + withAndroidManifest (XML patch).
//
// Source file: apps/mobile/cert-pinning/network_security_config.xml
// Destination: android/app/src/main/res/xml/network_security_config.xml
//
// Affects production Android builds only. Cleartext disabled in the XML
// itself, so a developer running a local HTTPS proxy (Charles / mitmproxy)
// against a pinned build will see TLS failures — temporarily remove the
// android:networkSecurityConfig attribute from AndroidManifest for that.

const fs = require("node:fs");
const path = require("node:path");
const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");

const SOURCE_REL = "cert-pinning/network_security_config.xml";
const DEST_REL = "android/app/src/main/res/xml/network_security_config.xml";
const RESOURCE_REF = "@xml/network_security_config";

function copyXmlIntoNativeProject(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const src = path.join(projectRoot, SOURCE_REL);
      const dst = path.join(projectRoot, DEST_REL);
      if (!fs.existsSync(src)) {
        throw new Error(`with-network-security-config: source not found at ${src}`);
      }
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
      return cfg;
    },
  ]);
}

function patchManifestApplication(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const app = manifest?.manifest?.application?.[0];
    if (!app) {
      throw new Error("with-network-security-config: <application> not found in AndroidManifest");
    }
    if (!app.$) app.$ = {};
    app.$["android:networkSecurityConfig"] = RESOURCE_REF;
    return cfg;
  });
}

module.exports = function withNetworkSecurityConfig(config) {
  config = copyXmlIntoNativeProject(config);
  config = patchManifestApplication(config);
  return config;
};
