import { createI18n } from "vue-i18n";
import en from "./locales/en";
import zhCN from "./locales/zh-CN";

export const LOCALE_STORAGE_KEY = "beeheader_locale";

export type AppLocale = "zh-CN" | "en";

const messages = {
  "zh-CN": zhCN,
  en,
};

/**
 * 根据浏览器 UI 语言推断默认 locale。
 */
export function detectDefaultLocale(): AppLocale {
  try {
    const ui = chrome.i18n?.getUILanguage?.() ?? navigator.language;
    if (ui.toLowerCase().startsWith("zh")) return "zh-CN";
  } catch {
  }
  return "en";
}

/**
 * 从 chrome.storage 读取用户选择的语言，无则 detectDefaultLocale。
 */
export async function loadStoredLocale(): Promise<AppLocale> {
  try {
    const stored = await chrome.storage.local.get(LOCALE_STORAGE_KEY);
    const raw = stored?.[LOCALE_STORAGE_KEY];
    if (raw === "zh-CN" || raw === "en") return raw;
  } catch {
  }
  return detectDefaultLocale();
}

/**
 * 持久化语言并切换 vue-i18n locale。
 */
export async function setAppLocale(
  localeRef: { value: string },
  locale: AppLocale,
) {
  localeRef.value = locale;
  try {
    await chrome.storage.local.set({ [LOCALE_STORAGE_KEY]: locale });
  } catch {
  }
  document.documentElement.lang = locale === "zh-CN" ? "zh-CN" : "en";
}

/**
 * 创建 Popup 用 vue-i18n 实例（unplugin 预编译 AST 消息 + JIT 解析，无 runtime eval）。
 */
export function createBeeI18n(initialLocale: AppLocale = "en") {
  return createI18n({
    legacy: false,
    locale: initialLocale,
    fallbackLocale: "en",
    messages,
  });
}

export type BeeI18n = ReturnType<typeof createBeeI18n>;

/** 供组件传入的 i18n 实例类型（vue-i18n Composer 安装实例） */
export type BeeI18nInstance = BeeI18n;