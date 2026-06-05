import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/dist/**"],
  },
  resolve: {
    alias: {
      // Mirror apps/web-admin/tsconfig.json's `@/*` -> `./*` path mapping so
      // unit tests under apps/web-admin can resolve `@/lib/...` imports.
      "@/": `${path.resolve(__dirname, "apps/web-admin")}/`,
    },
  },
});
