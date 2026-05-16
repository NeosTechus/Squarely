import type { ExpoConfig } from "expo/config";

const IS_DEV = process.env.APP_VARIANT === "development";

const config: ExpoConfig = {
  name: IS_DEV ? "Squarely (Dev)" : "Squarely",
  slug: "squarely",
  scheme: "squarely",
  version: "0.0.1",
  orientation: "default",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
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
    adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#ffffff" },
    permissions: ["CAMERA", "BLUETOOTH_CONNECT", "BLUETOOTH_SCAN", "INTERNET", "ACCESS_NETWORK_STATE"],
  },
  experiments: { typedRoutes: true },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-camera",
      { cameraPermission: "Squarely uses your camera to scan barcodes." },
    ],
    "expo-barcode-scanner",
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    revenuecatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
    revenuecatAndroidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
    eas: { projectId: "" },
  },
};

export default config;
