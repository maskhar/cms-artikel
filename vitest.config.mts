import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Sebelumnya tidak ada file ini sama sekali: `vitest run` jalan dengan default,
 * sehingga alias "@/..." milik tsconfig tidak pernah resolve. Test lama kebetulan
 * selamat karena semuanya memakai import relatif dan satu direktori.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
