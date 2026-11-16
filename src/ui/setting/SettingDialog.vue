<template>
  <div v-if="open" class="bh-manage-overlay">
    <div class="bh-manage-dialog" role="dialog" aria-labelledby="bh-setting-title">
      <div class="bh-manage-titlebar">
        <span id="bh-setting-title">{{ t("settingDialog.title") }}</span>
        <button
          type="button"
          class="bh-manage-close"
          :aria-label="t('settingDialog.close')"
          @click="open = false"
        >
          ×
        </button>
      </div>

      <div class="bh-setting-layout">
        <nav class="bh-setting-nav" :aria-label="t('settingDialog.title')">
          <ul class="bh-setting-menu" role="listbox">
            <li
              role="option"
              class="bh-setting-menu-item"
              :class="{ 'is-active': activeSection === 'global' }"
              :aria-selected="activeSection === 'global'"
              tabindex="0"
              @click="activeSection = 'global'"
              @keydown.enter.prevent="activeSection = 'global'"
            >
              {{ t("settingDialog.menuGlobal") }}
            </li>
            <li
              role="option"
              class="bh-setting-menu-item"
              :class="{ 'is-active': activeSection === 'about' }"
              :aria-selected="activeSection === 'about'"
              tabindex="0"
              @click="activeSection = 'about'"
              @keydown.enter.prevent="activeSection = 'about'"
            >
              {{ t("settingDialog.menuAbout") }}
            </li>
          </ul>
        </nav>

        <section class="bh-setting-pane">
          <div v-show="activeSection === 'global'" class="bh-setting-body">
            <h2 class="bh-setting-section-title">{{ t("settingDialog.menuGlobal") }}</h2>
            <dl class="bh-setting-meta">
              <div class="bh-setting-row">
                <dt>{{ t("settingDialog.language") }}</dt>
                <dd class="bh-setting-lang">
                  <label class="bh-lang-opt">
                    <input
                      v-model="localeChoice"
                      type="radio"
                      value="zh-CN"
                      @change="onLocaleChange"
                    />
                    {{ t("settingDialog.langZh") }}
                  </label>
                  <label class="bh-lang-opt">
                    <input v-model="localeChoice" type="radio" value="en" @change="onLocaleChange" />
                    {{ t("settingDialog.langEn") }}
                  </label>
                </dd>
              </div>
            </dl>
          </div>

          <div v-show="activeSection === 'about'" class="bh-setting-body">
            <p class="bh-setting-brand">{{ displayName }}</p>
            <p class="bh-setting-tagline">{{ t("settingDialog.tagline") }}</p>

            <dl class="bh-setting-meta">
              <div class="bh-setting-row">
                <dt>{{ t("settingDialog.version") }}</dt>
                <dd>{{ version }}</dd>
              </div>
              <div class="bh-setting-row">
                <dt>{{ t("settingDialog.buildDate") }}</dt>
                <dd>{{ buildDateLabel }}</dd>
              </div>
              <div class="bh-setting-row">
                <dt>{{ t("settingDialog.author") }}</dt>
                <dd>{{ author || "—" }}</dd>
              </div>
              <div class="bh-setting-row">
                <dt>{{ t("settingDialog.manifest") }}</dt>
                <dd>{{ manifestVersion }}</dd>
              </div>
            </dl>

            <p class="bh-setting-footer">{{ t("settingDialog.footer") }}</p>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 顶栏 Setting：左侧菜单（全局 / 关于），全局内切换语言；manage-mode 由 App 统一切换。
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { setAppLocale, type AppLocale } from "@/i18n";

type SettingSection = "global" | "about";

const open = defineModel<boolean>("open", { required: true });

const i18n = useI18n();
const { t, locale } = i18n;

/** 构建时由 Vite define 注入（见 define.config.ts） */
const version = __VERSION__;
const displayName = __DISPLAY_NAME__;
const author = __AUTHOR__;
const buildTimeIso = __BUILD_TIME__;
const manifestVersion = chrome.runtime.getManifest().version;

/** 左侧当前选中的设置分区，默认「全局」。 */
const activeSection = ref<SettingSection>("global");

const localeChoice = ref<AppLocale>(locale.value as AppLocale);

watch(
  () => locale.value,
  (v) => {
    if (v === "zh-CN" || v === "en") localeChoice.value = v;
  },
);

/**
 * 弹窗关闭后下次打开仍从「全局」进入，避免上次停留在关于页造成困惑。
 */
watch(open, (isOpen) => {
  if (!isOpen) activeSection.value = "global";
});

/**
 * 用户切换界面语言时写入 storage 并立即生效。
 */
async function onLocaleChange() {
  const next = localeChoice.value;
  await setAppLocale(locale, next);
}

/** 构建时间按当前界面语言格式化 */
const buildDateLabel = computed(() => {
  const d = new Date(buildTimeIso);
  if (Number.isNaN(d.getTime())) return buildTimeIso;
  const loc = locale.value === "zh-CN" ? "zh-CN" : "en";
  return d.toLocaleString(loc, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
});
</script>

<style scoped>
.bh-manage-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
  background: var(--bh-bg);
  box-sizing: border-box;
}
.bh-manage-dialog {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
  background: var(--bh-bg);
  overflow: hidden;
}
.bh-manage-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--bh-border);
  font-size: 14px;
  font-weight: 600;
}
.bh-manage-close {
  appearance: none;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: 20px;
  line-height: 1;
  color: var(--bh-muted);
  cursor: pointer;
}
.bh-manage-close:hover {
  background: #f3f4f6;
  color: var(--bh-fg);
}
.bh-setting-layout {
  display: flex;
  flex: 1;
  min-height: 0;
}
.bh-setting-nav {
  width: 140px;
  flex-shrink: 0;
  border-right: 1px solid var(--bh-border);
  min-height: 0;
}
.bh-setting-menu {
  list-style: none;
  margin: 0;
  padding: 6px;
}
.bh-setting-menu-item {
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--bh-fg);
  cursor: pointer;
  user-select: none;
}
.bh-setting-menu-item:hover {
  background: #f3f4f6;
}
.bh-setting-menu-item.is-active {
  background: #ede9fe;
  color: var(--bh-brand-700);
}
.bh-setting-pane {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.bh-setting-body {
  flex: 1;
  padding: 16px 18px 24px;
  overflow-y: auto;
}
.bh-setting-section-title {
  margin: 0 0 16px;
  font-size: 15px;
  font-weight: 600;
  color: var(--bh-fg);
}
.bh-setting-brand {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 650;
  color: var(--bh-fg);
}
.bh-setting-tagline {
  margin: 0 0 20px;
  font-size: 13px;
  color: var(--bh-muted);
}
.bh-setting-meta {
  margin: 0 0 20px;
  padding: 12px 14px;
  border: 1px solid var(--bh-border);
  border-radius: 10px;
  background: #f9fafb;
}
.bh-setting-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
  font-size: 13px;
  border-bottom: 1px solid var(--bh-border);
}
.bh-setting-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.bh-setting-row:first-child {
  padding-top: 0;
}
.bh-setting-row dt {
  margin: 0;
  color: var(--bh-muted);
  font-weight: 500;
}
.bh-setting-row dd {
  margin: 0;
  color: var(--bh-fg);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  text-align: right;
}
.bh-setting-lang {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-end;
  font-family: inherit;
}
.bh-lang-opt {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  cursor: pointer;
}
.bh-setting-footer {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--bh-muted);
}
</style>