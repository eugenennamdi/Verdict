import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  ssr: {
    noExternal: ["@x402/next"],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "next/server": path.resolve(__dirname, "./node_modules/next/server.js"),
    },
  },
});
