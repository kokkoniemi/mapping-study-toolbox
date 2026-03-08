import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["routes/**/*.test.ts", "tests/**/*.test.ts"],
    clearMocks: true,
  },
});
