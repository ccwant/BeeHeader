<template>
  <div class="bh-rules-block">
    <div class="bh-rules-heading">
      <div class="bh-rules-heading-main">
        <span class="bh-rules-text">{{ heading.title }}</span>
        <span class="bh-rules-hint">{{ heading.hint }}</span>
      </div>
      <button
        type="button"
        class="bh-rules-gear"
        aria-label="管理 URL 规则"
        title="管理 URL 规则"
        @click="openRulesDialog"
      >
        <svg
          viewBox="0 0 24 24"
          class="bh-rules-gear-icon"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
          />
        </svg>
      </button>
    </div>

    <div
      v-if="variant === 'auto'"
      class="bh-tabs bh-tabs--auto"
      role="tablist"
      aria-label="自动匹配规则"
    >
      <span v-if="ruleList.length === 0" class="bh-rules-empty">暂无</span>
      <button
        v-for="c in ruleList"
        :key="c.id"
        type="button"
        class="bh-tab"
        :class="{
          'bh-tab--alias': getRuleAlias(c),
          'bh-tab--editing': isEditingConfig(c),
          'bh-tab--matched': isAutoTabMatched(c),
        }"
        role="tab"
        :aria-selected="isEditingConfig(c)"
        :title="`编辑：${getTabLabel(c)}`"
        @click="c.id && selectForEdit(c.id)"
      >
        <input
          type="checkbox"
          class="bh-tab-check"
          :checked="isAutoTabMatched(c)"
          disabled
          aria-label="自动匹配状态"
          @click.stop
        />
        <span class="bh-tab-label">{{ getTabLabel(c) }}</span>
      </button>
    </div>

    <div
      v-else
      class="bh-tabs bh-tabs--manual"
      role="tablist"
      aria-label="手动切换规则"
    >
      <span v-if="ruleList.length === 0" class="bh-rules-empty">暂无</span>
      <div
        v-for="c in ruleList"
        :key="c.id"
        class="bh-tab bh-tab--with-check"
        :class="{
          'bh-tab--alias': getRuleAlias(c),
          'bh-tab--editing': isEditingConfig(c),
          'bh-tab--matched': isManualEffective(c),
        }"
        role="tab"
        :aria-selected="isManualEffective(c)"
      >
        <input
          type="checkbox"
          class="bh-tab-check"
          :checked="isManualEffective(c)"
          aria-label="启用手动规则"
          @click.stop
          @change="c.id && setManualEffective(c.id, ($event.target as HTMLInputElement).checked)"
        />
        <button
          type="button"
          class="bh-tab-body"
          :title="`编辑：${getTabLabel(c)}`"
          @click="c.id && selectForEdit(c.id)"
        >
          <span class="bh-tab-label">{{ getTabLabel(c) }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 自动或手动规则 tab；variant 决定列表来源与交互。
 */
import { computed, inject } from "vue";
import {
  getRuleAlias,
  getTabLabel,
  isAutoRuleScope,
  isManualRuleScope,
  isUrlMatchingScope,
} from "@/shared/utils/rules";
import type { HeaderConfigData } from "@/types";
import { POPUP_CORE_KEY } from "./popupCore";

const props = defineProps<{
  variant: "auto" | "manual";
}>();

const core = inject(POPUP_CORE_KEY)!;

/**
 * 打开全屏 RulesDialog，管理别名与 URL 规则。
 */
function openRulesDialog() {
  core.settingOpen.value = false;
  core.rulesOpen.value = true;
}

/** 区块标题与说明文案，随 variant 切换 */
const heading = computed(() =>
  props.variant === "auto"
    ? { title: "自动规则", hint: "根据URL正则自动匹配" }
    : { title: "手动规则", hint: "勾选后生效；点击名称编辑该规则的请求头" },
);

/** scope 为自动模式的规则子集 */
const autoConfigs = computed(() =>
  core.configs.value.filter((c) => isAutoRuleScope(c.scope)),
);

/** scope 为手动模式的规则子集 */
const manualConfigs = computed(() =>
  core.configs.value.filter((c) => isManualRuleScope(c.scope)),
);

/** variant 为 auto 时取自动规则列表，否则取手动规则列表 */
const ruleList = computed(() =>
  props.variant === "auto" ? autoConfigs.value : manualConfigs.value,
);

/**
 * 该自动规则是否应对应当前标签页 URL 显示为「已匹配」（只读勾选态）。
 * 依赖 core.currentTabUrl，由 popupCore.initPopup 刷新。
 */
function isAutoTabMatched(config: HeaderConfigData) {
  if (!config.id || !isAutoRuleScope(config.scope)) return false;
  const url = core.currentTabUrl.value;
  if (!url) return false;
  return isUrlMatchingScope(url, config.scope!);
}

/**
 * 点击规则名称时切换下方 HeaderRows 所绑定的规则 id。
 */
function selectForEdit(id: string) {
  core.activeId.value = id;
}

/**
 * 规则 tab 是否显示「编辑中」高亮（activeId 相等）。
 */
function isEditingConfig(config: HeaderConfigData) {
  return !!config.id && config.id === core.activeId.value;
}

/**
 * 手动规则 checkbox 是否点亮（与 manualEffectiveId 一致，决定 DNR 手动注入）。
 */
function isManualEffective(config: HeaderConfigData) {
  return !!config.id && core.manualActiveId.value === config.id;
}

/**
 * 用户勾选/取消手动规则：更新 manualActiveId 并写入 chrome.storage.local。
 * background 监听 manualEffectiveId 变化后刷新 DNR；非手动规则直接 return。
 */
async function setManualEffective(id: string, checked: boolean) {
  const config = core.configs.value.find((c) => c.id === id);
  if (!config || !isManualRuleScope(config.scope)) return;

  if (checked) core.manualActiveId.value = id;
  else if (core.manualActiveId.value === id) core.manualActiveId.value = null;
  else return;

  if (core.manualActiveId.value) {
    await chrome.storage.local.set({ manualEffectiveId: core.manualActiveId.value });
  } else {
    await chrome.storage.local.remove("manualEffectiveId");
  }
}
</script>

<style scoped>
.bh-rules-block {
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--bh-border);
}
.bh-rules-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 6px;
}
.bh-rules-heading-main {
  flex: 1;
  min-width: 0;
}
.bh-rules-gear {
  appearance: none;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid var(--bh-border);
  border-radius: 8px;
  background: #fff;
  color: var(--bh-muted);
  cursor: pointer;
}
.bh-rules-gear:hover {
  color: var(--bh-brand);
  border-color: var(--bh-brand);
  background: #faf5ff;
}
.bh-rules-gear-icon {
  width: 12px;
  height: 12px;
}
.bh-rules-text {
  font-size: 11px;
  font-weight: 600;
  color: var(--bh-fg);
}
.bh-rules-hint {
  margin: 0 0 0 10px;
  font-size: 11px;
  color: var(--bh-muted);
  line-height: 1.35;
}
.bh-rules-empty {
  font-size: 12px;
  color: var(--bh-muted);
  padding: 4px 2px;
}
.bh-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}
.bh-tab {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  vertical-align: middle;
  max-width: 160px;
  height: 28px;
  padding: 0 8px 0 10px;
  border: 1px solid var(--bh-border);
  border-radius: 8px;
  background: #ffffff;
  color: var(--bh-muted);
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  cursor: pointer;
  line-height: 1;
}
.bh-tab:hover {
  background: #f8fafc;
}
/* 编辑中 */
.bh-tab--editing {
  background: #f5f3ff;
  color: var(--bh-brand);
  border-color: var(--bh-brand);
}

.bh-tab--matched:not(.bh-tab--editing) {
  background: #ebf8ea;
  border-color: #87d27e;
  color: #047857;
}



.bh-tab--with-check {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding-left: 6px;
  cursor: default;
}
.bh-tab-check {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: #059669;
  flex-shrink: 0;
  cursor: pointer;
}
.bh-tab-check:disabled {
  cursor: default;
  opacity: 1;
}
.bh-tab-body {
  appearance: none;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  padding: 0;
  margin: 0;
  cursor: pointer;
  min-width: 0;
  flex: 1;
  text-align: left;
}
.bh-tab--with-check .bh-tab-body .bh-tab-label {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bh-tab-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bh-tab--alias .bh-tab-label {
  font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial,
    sans-serif;
  font-weight: 550;
}
</style>