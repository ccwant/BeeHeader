import { resolve } from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";
import { define } from "./define.config";

export default defineConfig({
  define: {
    ...define,
    /** 扩展 popup CSP 禁止 unsafe-eval，禁用 vue-i18n 消息编译器 */
    __INTLIFY_JIT_COMPILATION__: false,
    __INTLIFY_DROP_MESSAGE_COMPILER__: true,
  },
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
      "vue-i18n": resolve(
        __dirname,
        "node_modules/vue-i18n/dist/vue-i18n.runtime.esm-bundler.js",
      ),
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