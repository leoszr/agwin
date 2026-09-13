import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["test-fixtures/vitestSetup.ts"],
    include: ["src/**/*.test.ts", "pi-web-plugins/**/*.test.ts", "pi-packages/**/*.test.ts", "scripts/**/*.test.mjs"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
