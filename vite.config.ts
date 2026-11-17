import { resolve } from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import VueI18nPlugin from "@intlify/unplugin-vue-i18n/vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";
import { define } from "./define.config";

export default defineConfig({
  define: {
    ...define,
    /** 与 unplugin 预编译 AST 消息配合；编译器在运行时仅解析 AST，不用 eval */
    __INTLIFY_JIT_COMPILATION__: true,
  },
  plugins: [
    vue(),
    // 为符合扩展 CSP，项目使用了 vue-i18n runtime 构建（禁止 unsafe-eval）。在该模式下，带 {n}、{name} 的文案不会在运行时编译，t() 会反复返回 key（例如 rulesDialog.defaultRuleName）
    VueI18nPlugin({
      include: [resolve(__dirname, "src/i18n/locales/**")],
      runtimeOnly: true,
      compositionOnly: true,
      fullInstall: false,
      dropMessageCompiler: true,
    }),
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