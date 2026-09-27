import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests for admin helpers and source guards. Run: pnpm --filter @oh/admin test
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: { include: ["lib/**/__tests__/**/*.test.ts", "components/**/__tests__/**/*.test.ts"], environment: "node" },
});
