import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests for the web app: plan helpers plus the customer site (lib/site, components/site).
// Run: pnpm --filter @oh/web test
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    include: ["lib/**/__tests__/**/*.test.ts", "components/site/**/__tests__/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
