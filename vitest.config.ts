import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/fixtures/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/ui/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: [
        "src/server/credit/calculator.ts",
        "src/server/credit/decision.ts",
        "src/server/credit/state-machine.ts",
      ],
      thresholds: { statements: 90, lines: 90, functions: 90, branches: 80 },
    },
  },
});
