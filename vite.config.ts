import { resolve } from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";
import { define } from "./define.config";

export default defineConfig({
  define,
  plugins: [
    vue(),
    crx({
      manifest,
      /** 避免 manifest-post 阶段 content script 无 fileName（尤其 build -w） */
      contentScripts: {
        standaloneFiles: ["src/content/index.ts"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/ui/popup/index.html"),
      },
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
