<template>
  <div class="bh-rows">
    <div v-for="(h, i) in headers" :key="i" class="bh-header-row">
      <input
        v-model="h.enabled"
        type="checkbox"
        class="bh-h-enabled"
        aria-label="Toggle header"
        :disabled="fieldsDisabled"
        @change="onHeaderFieldChange"
      />
      <input
        v-model="h.name"
        class="bh-input bh-h-name"
        placeholder="Name"
        :disabled="fieldsDisabled"
        @input="onHeaderFieldChange"
        @keydown="focusNextValue"
      />
      <input
        v-model="h.value"
        class="bh-input bh-h-value"
        placeholder="Value"
        :disabled="fieldsDisabled"
        @input="onHeaderFieldChange"
        @keydown="addRowOnEnter"
      />
      <button
        type="button"
        class="bh-del bh-del-header"
        aria-label="Delete header"
        title="Delete"
        :disabled="fieldsDisabled"
        @click="removeHeaderRow(i)"
      >
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M6 6 L18 18 M18 6 L6 18"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>
  </div>

  <div class="bh-actions">
    <button type="button" class="bh-link" :disabled="fieldsDisabled" @click="addHeaderRow">
      + Add header
    </button>
  </div>
</template>

<script setup lang="ts">
/** 当前选中规则的请求头表格与防抖持久化 */
import { computed, inject, watch } from "vue";
import { isManualRuleScope } from "@/shared/utils/rules";
import type { HeaderConfigData, HeaderItem } from "@/types";
import { sendRuntimeMessage } from "./runtime";
import { POPUP_CORE_KEY } from "./popupCore";

const core = inject(POPUP_CORE_KEY)!;

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 与 activeConfig.headers 双向绑定；无行时自动补一行空 header 便于连续录入。
 */
const headers = computed({
  get() {
    const config = core.activeConfig.value;
    if (!config) return [];
    if (!config.headers || config.headers.length === 0) {
      config.headers = [{ name: "", value: "", type: "request", enabled: true }];
    }
    return config.headers;
  },
  set(rows: HeaderItem[]) {
    const config = core.activeConfig.value;
    if (config) config.headers = rows;
  },
});

/**
 * 全规则范围内是否存在有效 header；配合 globallyEnabled 得到 pausedExplicit。
 */
function hasAnyActiveHeaders() {
  return core.configs.value.some((c) =>
    (c.headers || []).some((h) => h.enabled !== false && (h.name || "").trim()),
  );
}

/**
 * 当前编辑的规则是否至少有一条可注入的 header（用于判断是否应自动 Resume）。
 */
function hasActiveHeadersInConfig(config: HeaderConfigData) {
  return (config.headers || []).some((h) => h.enabled !== false && (h.name || "").trim());
}

/** 全局 Pause 但仍有已填 header 时，禁用编辑区并显示 Pause 语义 */
const pausedExplicit = computed(() => {
  return !core.globallyEnabled.value && hasAnyActiveHeaders();
});



/** 表格与「Add header」是否应禁用（仅全局 Pause 且存在有效 header 时） */
const fieldsDisabled = computed(() => pausedExplicit.value);

/**
 * 申请全站权限；在 Pause 下首次填写有效 header 且允许手动生效时用于自动 Resume。
 */
async function requestAllSitesPermission() {
  if (!chrome.permissions?.request) return true;
  return new Promise<boolean>((resolve) => {
    chrome.permissions.request({ origins: ["*://*/*"] }, (ok) => resolve(!!ok));
  });
}

/**
 * 输入防抖 400ms，避免每个按键都 updateConfig。
 */
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void persistActiveConfig(), 400);
}

/**
 * 将当前规则的 headers 持久化到 background。
 * 若处于 Pause 且当前规则会被注入（含已勾选手动规则），会先 setGlobalEnabled(true) 再 updateConfig。
 */
async function persistActiveConfig() {
  const config = core.activeConfig.value;
  if (!config?.id) return;

  const isManual = isManualRuleScope(config.scope);
  const manualMayApply = !isManual || core.manualActiveId.value === config.id;
  const hasActive = hasActiveHeadersInConfig(config);
  const payload = { headers: config.headers || [] };

  if (!core.globallyEnabled.value && hasActive && manualMayApply) {
    const granted = await requestAllSitesPermission();
    if (granted) {
      const en = await sendRuntimeMessage<HeaderConfigData[]>("setGlobalEnabled", {
        enabled: true,
      });
      if (en.success && Array.isArray(en.data)) {
        core.configs.value = en.data;
        if (!core.configs.value.find((c) => c.id === core.activeId.value)) {
          core.activeId.value = core.configs.value[0]?.id ?? null;
        }
      }
    }
  }

  const res = await sendRuntimeMessage<HeaderConfigData>("updateConfig", {
    id: config.id,
    config: payload,
  });
  if (res.success && res.data) {
    const idx = core.configs.value.findIndex((c) => c.id === config.id);
    if (idx >= 0) core.configs.value[idx] = { ...core.configs.value[idx], ...res.data };
  }
}

/**
 * 在当前规则末尾追加空行并触发防抖保存。
 */
function addHeaderRow() {
  const config = core.activeConfig.value;
  if (!config) return;
  if (!config.headers) config.headers = [];
  config.headers.push({ name: "Name", value: "", type: "request", enabled: true });
  scheduleSave();
}

/**
 * 删除指定索引的 header 行并触发防抖保存。
 */
function removeHeaderRow(index: number) {
  const config = core.activeConfig.value;
  if (!config?.headers) return;
  config.headers.splice(index, 1);
  scheduleSave();
}

/**
 * 任意 header 字段变更时的统一入口，转调 scheduleSave。
 */
function onHeaderFieldChange() {
  scheduleSave();
}

/**
 * Name 列按 Enter：阻止提交并聚焦同行的 Value 输入框。
 */
function focusNextValue(e: KeyboardEvent) {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const row = (e.target as HTMLElement).closest(".bh-header-row");
  const valueInput = row?.querySelector<HTMLInputElement>(".bh-h-value");
  valueInput?.focus();
}

/**
 * Value 列按 Enter：阻止提交并新增下一行 header。
 */
function addRowOnEnter(e: KeyboardEvent) {
  if (e.key !== "Enter") return;
  e.preventDefault();
  addHeaderRow();
}

/** 切换编辑规则时保证至少有一行 header 可编辑 */
watch(
  () => core.activeId.value,
  () => {
    const config = core.activeConfig.value;
    if (config && (!config.headers || config.headers.length === 0)) {
      config.headers = [{ name: "", value: "", type: "request", enabled: true }];
    }
  },
);
</script>

<style scoped>
.bh-rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.bh-header-row {
  display: grid;
  grid-template-columns: auto 1fr 1fr auto;
  gap: 8px;
  align-items: center;
}
.bh-input {
  height: 28px;
  padding: 4px 8px;
  border: 1px solid var(--bh-border);
  border-radius: 8px;
  font-size: 13px;
  outline: none;
}
.bh-input:focus {
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.25);
  border-color: var(--bh-brand);
}
.bh-input[disabled] {
  background: #f9fafb;
  color: #6b7280;
  cursor: not-allowed;
}
.bh-del {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
}
.bh-del:hover {
  border-color: #fecaca;
  background: #fee2e2;
  color: var(--bh-danger);
}
.bh-del svg {
  width: 14px;
  height: 14px;
}
.bh-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
}
.bh-link {
  appearance: none;
  background: transparent;
  color: var(--bh-brand);
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 13px;
}
.bh-link:hover {
  color: var(--bh-brand-700);
  text-decoration: underline;
}
.bh-link[disabled] {
  color: #9ca3af;
  cursor: not-allowed;
  text-decoration: none;
}
.bh-h-enabled {
  accent-color: var(--bh-brand);
  width: 14px;
  height: 14px;
}
</style>