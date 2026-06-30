import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "apps/web"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: [
            "packages/**/__tests__/**/*.test.ts",
            "apps/web/__tests__/**/*.test.ts",
          ],
          exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "jsdom",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          include: ["apps/web/__tests__/**/*.test.tsx"],
          exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "packages/validators/src/**",
        "packages/trpc/src/**",
        "packages/ai/src/**",
        "apps/web/lib/approval-gate.ts",
      ],
    },
  },
});
