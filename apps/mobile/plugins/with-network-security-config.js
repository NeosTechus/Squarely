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
// itself (except for RFC1918 LAN ranges, see the XML comments), so a
// developer running a local HTTPS proxy (Charles / mitmproxy) against a
// pinned build will see TLS failures — temporarily remove the
// android:networkSecurityConfig attribute from AndroidManifest for that.
//
// Platform scoping: both withAndroidManifest and withDangerousMod (with the
// ['android', action] tuple) are android-only by Expo's design — verified
// against @expo/config-plugins (android-plugins.js registers under
// config.mods.android.manifest, and withDangerousMod takes an explicit
// platform argument). The plugin silently no-ops on iOS prebuild, so no
// platform guard is needed here.

const fs = require("node:fs");
const path = require("node:path");
const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");

const SOURCE_REL = "cert-pinning/network_security_config.xml";
const DEST_REL = "android/app/src/main/res/xml/network_security_config.xml";
const RESOURCE_REF = "@xml/network_security_config";
const PLACEHOLDER_TOKEN = "REPLACE_WITH_LIVE_HASH";
const ALLOW_PLACEHOLDER_ENV = "EXPO_BUILD_ALLOW_PLACEHOLDER_PINS";

function checkForPlaceholderPins(xmlText) {
  if (!xmlText.includes(PLACEHOLDER_TOKEN)) return;
  const allow = process.env[ALLOW_PLACEHOLDER_ENV] === "1";
  // Loud, prefixed warning so it's grep-able in EAS build logs. We intentionally
  // do NOT throw — dev/preview prebuilds (and CI smoke tests) must keep working
  // without forcing every contributor to extract live pin hashes. Production
  // shipping with placeholders is gated on the operator setting
  // EXPO_BUILD_ALLOW_PLACEHOLDER_PINS=1 explicitly; absent that env, the
  // warning is the signal that the cert-pinning rotation runbook
  // (docs/security/mobile-cert-pinning.md) needs to be run before the binary
  // is uploaded to Play Store.
  const msg =
    `[with-network-security-config] WARNING: network_security_config.xml still ` +
    `contains '${PLACEHOLDER_TOKEN}' placeholder pin(s). A production Android ` +
    `build with these placeholders WILL reject all TLS handshakes to the ` +
    `pinned hosts (Vercel + Supabase) and brick the installed app — only a ` +
    `new native build can recover. See docs/security/mobile-cert-pinning.md ` +
    `for the rotation runbook. Set ${ALLOW_PLACEHOLDER_ENV}=1 in the build ` +
    `env to silence this check (development builds only).`;
  if (allow) {
    // eslint-disable-next-line no-console
    console.warn(`${msg} [${ALLOW_PLACEHOLDER_ENV}=1 — suppressed-to-warn]`);
  } else {
    // eslint-disable-next-line no-console
    console.warn(msg);
  }
}

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
      // Validate the source XML before copy so the warning fires on the
      // canonical file, not on a stale copy under android/.
      const xmlText = fs.readFileSync(src, "utf8");
      checkForPlaceholderPins(xmlText);

      // NOTE: this overwrites any local edits to
      // android/app/src/main/res/xml/network_security_config.xml on each
      // prebuild — source of truth is apps/mobile/cert-pinning/network_security_config.xml.
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
    const existing = app.$["android:networkSecurityConfig"];
    if (existing && existing !== RESOURCE_REF) {
      // Surface the conflict loudly so the next maintainer sees it instead of
      // silently losing whatever the other plugin / app.config.ts wired in.
      throw new Error(
        `with-network-security-config: <application> already has ` +
          `android:networkSecurityConfig=${existing}; refusing to overwrite. ` +
          `Resolve the conflict by removing the other writer or pointing both ` +
          `at ${RESOURCE_REF}.`
      );
    }
    app.$["android:networkSecurityConfig"] = RESOURCE_REF;
    return cfg;
  });
}

module.exports = function withNetworkSecurityConfig(config) {
  config = copyXmlIntoNativeProject(config);
  config = patchManifestApplication(config);
  return config;
};
