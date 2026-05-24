const preset = require("@squarely/config/tailwind.preset").default;

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [preset, require("nativewind/preset")],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui-mobile/src/**/*.{ts,tsx}",
  ],
  // The mobile app is branded warm orange; the websites keep the default blue.
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
        },
      },
    },
  },
  plugins: [],
};
