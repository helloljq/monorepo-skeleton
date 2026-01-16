import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
    rollupOptions: {
      output: {
        manualChunks: {
          // 将 Monaco Editor 拆分为独立 chunk，避免首屏加载
          "monaco-editor": ["@monaco-editor/react"],
          // 图表库拆分
          recharts: ["recharts"],
          // UI 组件库拆分
          "radix-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
          ],
        },
      },
    },
  },
  server: {
    host: true,
    port: 17001,
    strictPort: true,
    allowedHosts: [
      "admin-dev.monorepo-skeleton.test",
      "monorepo-skeleton.test",
    ],
    proxy: {
      "/api": {
        target: "https://api-dev.monorepo-skeleton.test",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 17001,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
