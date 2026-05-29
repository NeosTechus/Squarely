import type { ExpoConfig } from "expo/config";

const IS_DEV = process.env.APP_VARIANT === "development";

const config: ExpoConfig = {
  name: IS_DEV ? "Squarely (Dev)" : "Squarely",
  slug: "squarely",
  owner: "harshakolla90s-organization",
  scheme: "squarely",
  version: "0.0.1",
  orientation: "default",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  // OTA updates (EAS Update). runtimeVersion ties a JS update to compatible
  // native builds; bump native version when native code changes.
  runtimeVersion: { policy: "appVersion" },
  updates: { url: "https://u.expo.dev/8b898bf1-15e6-4f5b-9ab6-5c1b1b5e2122" },
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
      NSCameraUsageDescription:
        "Squarely uses your camera to scan barcodes for inventory lookup at the register.",
      NSBluetoothAlwaysUsageDescription:
        "Squarely connects to Bluetooth barcode scanners and card readers.",
      NSLocalNetworkUsageDescription:
        "Squarely connects to receipt printers on your local network.",
    },
  },
  android: {
    package: IS_DEV ? "com.squarely.app.dev" : "com.squarely.app",
    adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#ea580c" },
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
