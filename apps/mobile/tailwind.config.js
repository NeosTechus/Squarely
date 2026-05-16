const preset = require("@squarely/config/tailwind.preset").default;

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [preset],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui-mobile/src/**/*.{ts,tsx}",
  ],
  theme: { extend: {} },
  plugins: [],
};
