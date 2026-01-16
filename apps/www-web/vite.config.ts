import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // 确保 workspace 包中的 TS 源码被正确处理
  optimizeDeps: {
    include: [
      "@monorepo-skeleton/shared-types",
      "@monorepo-skeleton/shared-utils",
    ],
  },
  build: {
    // 确保构建时也能正确处理 workspace 包
    commonjsOptions: {
      include: [/shared-types/, /shared-utils/, /node_modules/],
    },
  },
  server: {
    host: true,
    port: 17002,
    strictPort: true,
    allowedHosts: ["www-dev.monorepo-skeleton.test"],
    proxy: {
      "/api": {
        target: "https://api-dev.monorepo-skeleton.test",
        changeOrigin: true,
      },
    },
  },
});
