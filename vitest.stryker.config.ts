import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["test-fixtures/vitestSetup.ts"],
    include: process.env.STRYKER_TEST_INCLUDE
      ? [process.env.STRYKER_TEST_INCLUDE]
      : ["src/client/src/api/**/*.test.ts"],
  },
});
