import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/server-only.ts"),
    },
  },
  test: { environment: "node", env: { MELA_DB_PATH: ":memory:", MELA_SKIP_SEED: "1", MELA_DEMO_MODE: "off" } },
});
