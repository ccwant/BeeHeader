<template>
  <div v-if="open" class="bh-manage-overlay">
    <div class="bh-manage-dialog" role="dialog" aria-labelledby="bh-setting-title">
      <div class="bh-manage-titlebar">
        <span id="bh-setting-title">关于 BeeHeader</span>
        <button type="button" class="bh-manage-close" aria-label="关闭" @click="open = false">×</button>
      </div>

      <div class="bh-setting-body">
        <p class="bh-setting-brand">{{ displayName }}</p>
        <p class="bh-setting-tagline">轻量 HTTP 请求头编辑器</p>

        <dl class="bh-setting-meta">
          <div class="bh-setting-row">
            <dt>版本</dt>
            <dd>{{ version }}</dd>
          </div>
          <div class="bh-setting-row">
            <dt>构建日期</dt>
            <dd>{{ buildDateLabel }}</dd>
          </div>
          <div class="bh-setting-row">
            <dt>作者</dt>
            <dd>{{ author || "—" }}</dd>
          </div>
          <div class="bh-setting-row">
            <dt>Manifest</dt>
            <dd>{{ manifestVersion }}</dd>
          </div>
        </dl>

        <p class="bh-setting-footer">
          在规则区标题右侧齿轮管理 URL 规则；Pause/Resume 控制全局注入。
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 顶栏 Setting 打开的关于页：版本、构建时间等；manage-mode 由 App 统一切换。
 */
import { computed } from "vue";

const open = defineModel<boolean>("open", { required: true });

const version = __VERSION__;
const displayName = __DISPLAY_NAME__;
const author = __AUTHOR__;
const buildTimeIso = __BUILD_TIME__;
const manifestVersion = chrome.runtime.getManifest().version;

/**
 * 将构建 ISO 时间格式化为本地可读日期时间。
 */
const buildDateLabel = computed(() => {
  const d = new Date(buildTimeIso);
  if (Number.isNaN(d.getTime())) return buildTimeIso;
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
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
.bh-setting-body {
  flex: 1;
  padding: 20px 18px 24px;
  overflow-y: auto;
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
.bh-setting-footer {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--bh-muted);
}
</style>