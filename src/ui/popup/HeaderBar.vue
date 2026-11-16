<template>
  <div class="bh-headerbar">
    <div class="bh-title">
      <img :src="iconUrl" alt="" width="18" height="18" />
      BeeHeader
    </div>
    <div class="bh-hb-actions">
      <button
        type="button"
        class="bh-btn bh-toggle"
        :data-enabled="uiEnabled ? 'true' : 'false'"
        @click="toggleGlobal"
      >
        <template v-if="uiEnabled">
          <svg
            viewBox="0 0 24 24"
            class="bh-icon"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
          <span>Pause</span>
        </template>
        <template v-else>
          <svg
            viewBox="0 0 24 24"
            class="bh-icon"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
          <span>Resume</span>
        </template>
      </button>
      <button type="button" class="bh-btn bh-link" @click="openSettingDialog">
        <svg
          viewBox="0 0 24 24"
          class="bh-icon"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polygon
            points="12 3 19.794 7.5 19.794 16.5 12 21 4.206 16.5 4.206 7.5"
          />
        </svg>
        <span>Setting</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/** 顶栏：品牌、全局 Pause/Resume、打开设置 */
import { computed, inject } from "vue";
import type { HeaderConfigData } from "@/types";
import { sendRuntimeMessage } from "./runtime";
import { POPUP_CORE_KEY } from "./popupCore";

const iconUrl = chrome.runtime.getURL("icons/icon32.png");
const core = inject(POPUP_CORE_KEY)!;

/**
 * 判断是否在任意规则下存在「已启用且名称非空」的 header。
 * 用于决定顶栏显示 Pause 还是 Resume（无有效 header 时仍显示 Resume）。
 */
function hasAnyActiveHeaders() {
  return core.configs.value.some((c) =>
    (c.headers || []).some((h) => h.enabled !== false && (h.name || "").trim()),
  );
}

/** true 时顶栏文案为 Pause，否则为 Resume */
const uiEnabled = computed(() => core.globallyEnabled.value || !hasAnyActiveHeaders());

/**
 * 向用户申请 host_permissions 全站访问；无 permissions API 时直接视为已授权。
 * Resume 前必须成功，否则不调用 setGlobalEnabled。
 */
async function requestAllSitesPermission() {
  if (!chrome.permissions?.request) return true;
  return new Promise<boolean>((resolve) => {
    chrome.permissions.request({ origins: ["*://*/*"] }, (ok) => resolve(!!ok));
  });
}

/**
 * 打开关于/设置页 SettingDialog；规则 CRUD 见 RulesDialog（规则区齿轮）。
 */
function openSettingDialog() {
  core.rulesOpen.value = false;
  core.settingOpen.value = true;
}

/**
 * 顶栏 Pause / Resume 切换：调用 background setGlobalEnabled 并回写 configs。
 * 需 Resume 时先 requestAllSitesPermission；成功后修正 activeId 若当前规则被删。
 */
async function toggleGlobal() {
  const hasActive = hasAnyActiveHeaders();
  const currentlyUiEnabled = core.globallyEnabled.value || !hasActive;
  const desiredEnabled = !currentlyUiEnabled;
  if (desiredEnabled === core.globallyEnabled.value && hasActive) return;

  if (desiredEnabled) {
    const granted = await requestAllSitesPermission();
    if (!granted) return;
  }

  const res = await sendRuntimeMessage<HeaderConfigData[]>("setGlobalEnabled", {
    enabled: desiredEnabled,
  });
  if (res.success) {
    if (Array.isArray(res.data) && res.data.length) {
      core.configs.value = res.data;
      if (!core.configs.value.find((c) => c.id === core.activeId.value)) {
        core.activeId.value = core.configs.value[0]?.id ?? null;
      }
    } else {
      core.configs.value.forEach((c) => {
        c.enabled = desiredEnabled;
      });
    }
  }
}
</script>

<style scoped>
.bh-headerbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.bh-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 620;
  letter-spacing: -0.01em;
  color: var(--bh-fg);
}
.bh-title img {
  display: block;
  width: 18px;
  height: 18px;
  border-radius: 5px;
}
.bh-hb-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bh-icon {
  width: 14px;
  height: 14px;
  display: block;
}
.bh-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px solid var(--bh-border);
  background: #ffffff;
  color: #111827;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}
.bh-btn:hover {
  background: #f3f4f6;
}
.bh-toggle {
  min-width: 88px;
}
.bh-toggle[data-enabled="false"] {
  background: #ffffff;
  color: #059669;
  border-color: #059669;
}
.bh-toggle[data-enabled="false"]:hover {
  background: #ecfdf5;
}
.bh-btn.bh-link {
  min-width: 88px;
}
</style>