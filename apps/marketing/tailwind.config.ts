import type { Config } from "tailwindcss";
import preset from "@squarely/config/tailwind.preset";

export default {
  presets: [preset as Config],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui-web/src/**/*.{ts,tsx}",
  ],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
