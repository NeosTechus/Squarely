import type { ExpoConfig } from "expo/config";

const IS_DEV = process.env.APP_VARIANT === "development";

const config: ExpoConfig = {
  name: IS_DEV ? "Squarely (Dev)" : "Squarely",
  slug: "squarely",
  owner: "harshakolla90s-organization",
  scheme: "squarely",
  // Bumped from 0.0.1 -> 0.1.0 for first public release. runtimeVersion policy
  // is "appVersion", so the version string IS the OTA bucket: shipping at
  // 0.0.1 forever would mean every release collides in the same bucket and a
  // bad JS update can't be cleanly rolled forward. Bump on each native release.
  version: "0.1.0",
  // POS app is counter-mounted tablet first — lock to landscape so the register
  // doesn't flip to portrait when an attendant tilts the device. supportsTablet
  // is on for iOS; on phones this still allows landscape (which is fine for
  // a tap-to-charge / receipt-print flow).
  orientation: "landscape",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  // OTA updates (EAS Update). runtimeVersion ties a JS update to compatible
  // native builds; bump native version when native code changes.
  runtimeVersion: { policy: "appVersion" },
  // Cold-start fast: serve cached JS immediately and fetch any OTA update in
  // the background (instead of blocking launch on the update check).
  updates: { url: "https://u.expo.dev/8b898bf1-15e6-4f5b-9ab6-5c1b1b5e2122", fallbackToCacheTimeout: 0 },
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: IS_DEV ? "com.squarely.app.dev" : "com.squarely.app",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      // NSCameraUsageDescription and NSBluetoothAlwaysUsageDescription are
      // intentionally OMITTED. Apple App Review flags unused usage strings:
      //   - Barcode capture is keyboard-wedge (HID) only — no expo-camera in
      //     the bundle and no BLE pairing. chargeOnTerminal() in
      //     apps/mobile/lib/terminalCharge.ts routes through HTTPS to
      //     web-admin (/api/payments/start), not native BLE.
      // Re-add (with matching Android permissions: CAMERA / BLUETOOTH_SCAN /
      // BLUETOOTH_CONNECT) when expo-camera or a BLE library is actually
      // integrated. See PR notes for the audit decision.
      NSLocalNetworkUsageDescription:
        "Squarely connects to receipt printers on your local network.",
    },
  },
  android: {
    package: IS_DEV ? "com.squarely.app.dev" : "com.squarely.app",
    adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#ea580c" },
    // Permissions are intentionally minimal:
    //   - INTERNET: required for HTTPS to web-admin and Supabase.
    //   - ACCESS_NETWORK_STATE: queue/online detection for offline-tolerant POS.
    // NOT included (audited against the codebase 2026-06-08):
    //   - CAMERA: no expo-camera / BarCodeScanner usage; barcode capture is
    //     keyboard-wedge via TextInput onSubmitEditing.
    //   - BLUETOOTH_SCAN / BLUETOOTH_CONNECT: no native BLE pairing.
    //     chargeOnTerminal() dispatches to web-admin over HTTPS; barcode
    //     scanners are HID/keyboard-wedge, not BLE.
    //   - POST_NOTIFICATIONS: no expo-notifications usage yet. Add (declared
    //     as "NOTIFICATIONS" via expo-notifications) when queued-print status
    //     or refund alerts are introduced.
    permissions: ["INTERNET", "ACCESS_NETWORK_STATE"],
  },
  experiments: { typedRoutes: true },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-build-properties",
      {
        android: {
          kotlinVersion: "1.9.25",
          // Shrink the release APK: strip unused code (R8/Proguard) and resources.
          enableProguardInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
      },
    ],
    // Build for arm64 only — covers essentially all modern devices and roughly
    // halves the universal APK (which otherwise bundles 4 CPU architectures).
    "./plugins/with-arm64.js",
    // TLS certificate pinning (Android only). Copies
    // cert-pinning/network_security_config.xml into the native project at
    // prebuild and patches AndroidManifest's <application> tag.
    // Pinned hosts: *.vercel.app (web admin), *.supabase.co (Supabase project).
    // Rotation runbook: docs/security/mobile-cert-pinning.md.
    // iOS does not pin yet — ATS can't pin SPKI without a native lib (TrustKit).
    "./plugins/with-network-security-config.js",
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    revenuecatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
    revenuecatAndroidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
    eas: { projectId: "8b898bf1-15e6-4f5b-9ab6-5c1b1b5e2122" },
  },
};

export default config;
