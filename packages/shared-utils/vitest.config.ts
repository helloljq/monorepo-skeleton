import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.{test,spec}.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      exclude: ["node_modules/", "**/*.d.ts", "vitest.config.ts"],
    },
  },
});
