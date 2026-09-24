import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests for the web app's plan helpers (JWT session, IP hashing).
// Run: pnpm --filter @oh/web test
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    include: ["lib/plan/**/__tests__/**/*.test.ts"],
    environment: "node",
  },
});
