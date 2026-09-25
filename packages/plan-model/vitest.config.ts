import { defineConfig } from "vitest/config";

// The engine is the part of the plan that must never be wrong in front of an
// investor, so coverage is a hard 100% gate (spec 5.1).
export default defineConfig({
  test: {
    include: ["src/__tests__/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**", "src/index.ts"],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
      reporter: ["text", "text-summary"],
    },
  },
});
