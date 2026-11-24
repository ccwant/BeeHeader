<template>
  <div v-if="open" class="bh-manage-overlay">
    <div class="bh-manage-dialog" role="dialog" aria-labelledby="bh-manage-title">
      <div class="bh-manage-titlebar">
        <span id="bh-manage-title">{{ t("rulesDialog.title") }}</span>
        <button
          type="button"
          class="bh-manage-close"
          :aria-label="t('rulesDialog.close')"
          @click="open = false"
        >
          ×
        </button>
      </div>

      <div class="bh-manage-layout">
        <aside class="bh-manage-left">
          <div class="bh-manage-toolbar bh-manage-toolbar--left">
            <button type="button" class="bh-btn bh-btn-primary" @click="addRule">
              {{ t("rulesDialog.add") }}
            </button>
            <button type="button" class="bh-btn" @click="exportRules">
              {{ t("rulesDialog.export") }}
            </button>
            <button type="button" class="bh-btn" @click="openImportPicker">
              {{ t("rulesDialog.import") }}
            </button>
            <input
              ref="fileInput"
              type="file"
              class="bh-manage-file-input"
              accept="application/json,.json"
              @change="onImportFileChange"
            />
          </div>
          <ul class="bh-manage-list" role="listbox">
            <li
              v-for="c in configs"
              :key="c.id"
              class="bh-manage-item"
              :class="{ 'is-active': c.id === selectedId }"
              role="option"
              :aria-selected="c.id === selectedId"
              @click="c.id && selectRule(c.id)"
            >
              <span class="bh-manage-item-label">{{ getTabLabel(c) }}</span>
            </li>
          </ul>
        </aside>

        <section class="bh-manage-right">
          <div class="bh-manage-toolbar bh-manage-toolbar--right">
            <button
              type="button"
              class="bh-btn bh-btn-danger"
              :disabled="!canDelete"
              @click="deleteRuleWithConfirm"
            >
              {{ t("rulesDialog.delete") }}
            </button>
            <button
              type="button"
              class="bh-btn"
              :class="{ 'bh-btn-primary': isSaveDirty, 'bh-btn-save-idle': !isSaveDirty }"
              :disabled="!isSaveDirty"
              @click="saveRule"
            >
              {{ t("rulesDialog.save") }}
            </button>
          </div>
          <form class="bh-manage-form" novalidate @submit.prevent="saveRule">
            <p v-if="formError" class="bh-manage-form-error" role="alert">{{ formError }}</p>
            <label class="bh-field">
              <span class="bh-field-label">
                {{ t("rulesDialog.aliasLabel") }}
                <span class="bh-required">{{ t("rulesDialog.required") }}</span>
              </span>
              <input
                v-model="alias"
                type="text"
                class="bh-input"
                :placeholder="t('rulesDialog.aliasPlaceholder')"
                autocomplete="off"
              />
            </label>
            <label class="bh-field">
              <span class="bh-field-label">{{ t("rulesDialog.urlLabel") }}</span>
              <input
                v-model="pattern"
                type="text"
                class="bh-input bh-input-mono"
                :placeholder="t('rulesDialog.urlPlaceholder')"
                autocomplete="off"
              />
            </label>
          </form>
        </section>
      </div>
    </div>
  </div>
</template>


<script setup lang="ts">
/**
 * 全屏「管理 URL 规则」：列表、表单脏检查、CRUD 与 JSON 导入导出。
 * 由规则区齿轮打开；注入 POPUP_CORE_KEY 与主界面共享 configs/activeId。
 */
import { computed, inject, ref, watch } from "vue";
import {
  buildRulesExportDocument,
  getPatternLabel,
  getRuleAlias,
  getTabLabel,
  nextDefaultRuleName,
  parseRulesImportJson,
  patternToScope,
  rulesImportPreview,
} from "@/shared/utils/rules";
import { ValidationUtils } from "@/shared/utils/validation";
import type { HeaderConfigData } from "@/types";
import { formatRulesImportError } from "@/i18n/formatImportError";
import { useFeedback } from "../feedback/useFeedback";
import { POPUP_CORE_KEY } from "../popup/popupCore";
import { sendRuntimeMessage } from "../popup/runtime";
import { useI18n } from "vue-i18n";
import type { RulesImportError } from "@/shared/utils/rules";

const open = defineModel<boolean>("open", { required: true });

const core = inject(POPUP_CORE_KEY)!;

const { t, te, locale } = useI18n();
const { showToast, showConfirm } = useFeedback();

/**
 * 将校验 key 或 background 原文转为当前语言文案。
 */
function tr(text: string) {
  return te(text) ? t(text) : text;
}

const selectedId = ref<string | null>(null);
const alias = ref("");
const pattern = ref("");
const formError = ref("");
const fileInput = ref<HTMLInputElement | null>(null);
const baselineAlias = ref("");
const baselinePattern = ref("");

const configs = core.configs;

/** 有选中项即可点删除（删最后一条时后台会补默认规则） */
const canDelete = computed(
  () => core.configs.value.length > 0 && !!selectedId.value,
);

/** 记录当前表单值为 baseline，isSaveDirty 与之比较 */
function syncFormBaseline() {
  baselineAlias.value = alias.value;
  baselinePattern.value = pattern.value;
}

/**
 * 按 selectedId 把别名、URL pattern 填入表单，并重置 dirty 基线。
 */
function loadForm() {
  formError.value = "";
  const config = core.configs.value.find((c) => c.id === selectedId.value);
  if (!config) {
    alias.value = "";
    pattern.value = "";
    syncFormBaseline();
    return;
  }
  const name = (config.name || "").trim();
  const patternLabel = getPatternLabel(config);
  alias.value =
    name.length > 2
      ? name
      : getRuleAlias(config) || (name !== patternLabel && name !== "*" ? name : "");
  pattern.value = patternLabel === "*" ? "" : patternLabel;
  syncFormBaseline();
}

/** 别名或 URL 相对上次 load/save 有改动时保存按钮可点 */
const isSaveDirty = computed(
  () =>
    alias.value !== baselineAlias.value || pattern.value !== baselinePattern.value,
);

/**
 * 左侧列表选中一条规则并刷新右侧表单。
 */
function selectRule(id: string) {
  selectedId.value = id;
  loadForm();
}

/** 触发隐藏的 file input 选择 JSON */
function openImportPicker() {
  fileInput.value?.click();
}

/** 用户选中文件后交给 importRules 解析并批量追加 */
function onImportFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (file) void importRules(file);
}

/**
 * 新增默认手动规则（新规则N），选中并同步主界面 activeId。
 */
async function addRule() {
  formError.value = "";
  const name = nextDefaultRuleName(core.configs.value, (n) =>
    t("rulesDialog.defaultRuleName", { n }),
  );
  const res = await sendRuntimeMessage<HeaderConfigData>("addConfig", {
    name,
    enabled: core.globallyEnabled.value,
    headers: [],
    scope: { type: "all", value: "" },
  });
  if (!res.success || !res.data) {
    formError.value = tr(res.error || "rulesDialog.addFail");
    return;
  }
  core.configs.value.push(res.data as HeaderConfigData);
  const newId = (res.data as HeaderConfigData).id ?? null;
  selectedId.value = newId;
  core.activeId.value = newId;
  loadForm();
  core.syncActiveEditingId();
}

/**
 * 校验别名后 updateConfig 更新 name/scope。
 */
async function saveRule() {
  const aliasErr = ValidationUtils.validateRuleAlias(alias.value);
  if (aliasErr) {
    formError.value = t(aliasErr);
    return;
  }
  formError.value = "";
  const name = alias.value.trim();
  const scope = patternToScope(pattern.value);

  if (!selectedId.value) return;
  const id = selectedId.value;
  const res = await sendRuntimeMessage<HeaderConfigData>("updateConfig", {
    id,
    config: { scope, name },
  });
  if (res.success && res.data) {
    const idx = core.configs.value.findIndex((c) => c.id === id);
    if (idx >= 0) {
      core.configs.value[idx] = { ...core.configs.value[idx], ...res.data };
    }
    core.syncActiveEditingId();
    loadForm();
    showToast(t("rulesDialog.toastSaveOk"));
  } else {
    showToast(tr(res.error || "rulesDialog.toastSaveFail"), 2800);
  }
}

/** 将全部规则序列化为 JSON 并触发浏览器下载 */
function exportRules() {
  formError.value = "";
  try {
    const doc = buildRulesExportDocument(core.configs.value);
    const blob = new Blob([JSON.stringify(doc, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = url;
    a.download = `beeheader-rules-${stamp}.json`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    formError.value = t("rulesDialog.exportFail");
  }
}

/**
 * 读取 JSON，经 rulesImportPreview 校验后 importConfigs 追加到后台。
 */
async function importRules(file: File) {
  formError.value = "";
  let text: string;
  try {
    text = await file.text();
  } catch {
    formError.value = t("rulesDialog.readFileFail");
    return;
  }

  const parsed = parseRulesImportJson(text);
  if (!Array.isArray(parsed)) {
    formError.value = formatRulesImportError(parsed as RulesImportError, t);
    return;
  }

  const { items, errors } = rulesImportPreview(parsed);
  if (errors.length > 0) {
    const sep = locale.value === "zh-CN" ? "；" : "; ";
    const parts = errors
      .slice(0, 3)
      .map((e) => formatRulesImportError(e, t));
    formError.value =
      parts.join(sep) + (errors.length > 3 ? t("rulesDialog.importErrorsMore") : "");
    return;
  }
  if (items.length === 0) {
    formError.value = t("rulesDialog.importNone");
    return;
  }

  const res = await sendRuntimeMessage<HeaderConfigData[]>("importConfigs", {
    configs: items,
  });
  if (!res.success) {
    formError.value = tr(res.error || "rulesDialog.importFail");
    return;
  }
  if (Array.isArray(res.data)) {
    core.configs.value = res.data;
    selectedId.value = core.configs.value[0]?.id ?? null;
    loadForm();
    core.syncActiveEditingId();
  }
}

/**
 * 调用 deleteConfig；若删的是当前编辑或手动生效规则则修正 id 并刷新 DNR。
 */
async function deleteRule() {
  const id = selectedId.value;
  if (!id || core.configs.value.length <= 0) return;

  const res = await sendRuntimeMessage<HeaderConfigData[]>("deleteConfig", { id });
  if (!res.success) {
    const msg = tr(res.error || "rulesDialog.deleteFail");
    formError.value = msg;
    showToast(msg, 2800);
    return;
  }
  if (res.data?.length) {
    core.configs.value = res.data;
  } else {
    core.configs.value = core.configs.value.filter((c) => c.id !== id);
  }
  if (core.activeId.value === id) {
    core.activeId.value = core.configs.value[0]?.id ?? null;
  }
  selectedId.value = core.configs.value[0]?.id ?? null;
  loadForm();
}

/**
 * 经 showConfirm 二次确认后执行 deleteRule。
 */
async function deleteRuleWithConfirm() {
  const id = selectedId.value;
  if (!id || core.configs.value.length <= 0) return;

  const config = core.configs.value.find((c) => c.id === id);
  const label = config ? getTabLabel(config) : t("rulesDialog.thisRule");
  const ok = await showConfirm({
    title: t("rulesDialog.deleteTitle"),
    message: t("rulesDialog.deleteMessage", { name: label }),
    confirmText: t("rulesDialog.deleteConfirm"),
    cancelText: t("feedback.cancel"),
    danger: true,
  });
  if (!ok) return;
  await deleteRule();
}

/** 打开时同步主界面当前选中规则并加载表单 */
watch(open, (isOpen) => {
  if (isOpen) {
    selectedId.value = core.activeId.value;
    loadForm();
  }
});
</script>


<style scoped>
.bh-manage-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
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
.bh-manage-layout {
  display: flex;
  flex: 1;
  min-height: 0;
}
.bh-manage-left {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--bh-border);
  min-width: 0;
}
.bh-manage-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.bh-manage-toolbar {
  padding: 8px;
  border-bottom: 1px solid var(--bh-border);
}
.bh-manage-toolbar--left {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.bh-manage-file-input {
  display: none;
}
.bh-manage-toolbar--right {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.bh-manage-list {
  list-style: none;
  margin: 0;
  padding: 6px;
  overflow-y: auto;
  flex: 1;
}
.bh-manage-item {
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--bh-muted);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bh-manage-item:hover {
  background: #f8fafc;
  color: var(--bh-fg);
}
.bh-manage-item.is-active {
  background: #f5f3ff;
  color: var(--bh-brand-700);
}
.bh-manage-form {
  padding: 12px 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}
.bh-btn {
  appearance: none;
  height: 28px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid var(--bh-border);
  background: #fff;
  color: var(--bh-fg);
}
.bh-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.bh-btn-save-idle:disabled {
  opacity: 1;
  cursor: default;
  color: var(--bh-muted);
  background: #f9fafb;
  border-color: var(--bh-border);
}
.bh-btn-primary {
  border-color: var(--bh-brand);
  color: var(--bh-brand);
  background: #faf5ff;
}
.bh-btn-primary:hover:not(:disabled) {
  background: #f5f3ff;
}
.bh-btn-danger {
  border-color: #fecaca;
  color: var(--bh-danger);
  background: #fff;
}
.bh-btn-danger:hover:not(:disabled) {
  background: #fee2e2;
}
.bh-input {
  height: 28px;
  padding: 4px 8px;
  border: 1px solid var(--bh-border);
  border-radius: 8px;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
  width: 100%;
}
.bh-input:focus {
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.25);
  border-color: var(--bh-brand);
}
.bh-manage-form .bh-input {
  height: 34px;
  font-size: 13px;
}
.bh-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bh-field-label {
  font-size: 12px;
  color: var(--bh-muted);
}
.bh-required {
  color: var(--bh-danger);
}
.bh-manage-form-error {
  margin: 0;
  padding: 8px 10px;
  font-size: 12px;
  color: var(--bh-danger);
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
}
.bh-input-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}
</style>