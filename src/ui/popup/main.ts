import { createApp } from "vue";
import App from "./App.vue";
import { createBeeI18n, loadStoredLocale, setAppLocale } from "@/i18n";

/**
 * Popup 入口：加载语言偏好后挂载 App。
 */
async function bootstrap() {
  const locale = await loadStoredLocale();
  const i18n = createBeeI18n(locale);
  await setAppLocale(i18n.global.locale, locale);
  createApp(App).use(i18n).mount("#app");
}

void bootstrap();