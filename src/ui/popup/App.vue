<template>
  <FeedbackHost :host="feedbackHost">
    <div class="bh-container" :class="{ 'is-managing': manageOverlayOpen }">
      <template v-if="!manageOverlayOpen">
        <HeaderBar />
        <RulesBlock variant="auto" />
        <RulesBlock variant="manual" />
        <HeaderRows />
      </template>
      <RulesDialog v-model:open="rulesOpen" />
      <SettingDialog v-model:open="settingOpen" />
    </div>
  </FeedbackHost>
</template>

<script setup lang="ts">
/**
 * Popup 壳：创建共享状态、provide 给子组件与全屏 dialog。
 */
import { computed, onMounted, provide, watch } from "vue";
import { FEEDBACK_KEY, createFeedback } from "../feedback/useFeedback";
import FeedbackHost from "../feedback/FeedbackHost.vue";
import RulesDialog from "../setting/RulesDialog.vue";
import SettingDialog from "../setting/SettingDialog.vue";
import HeaderBar from "./HeaderBar.vue";
import RulesBlock from "./RulesBlock.vue";
import HeaderRows from "./HeaderRows.vue";
import { setManageMode } from "./manageMode";
import { POPUP_CORE_KEY, createPopupCore } from "./popupCore";

const popup = createPopupCore();
const settingOpen = popup.settingOpen;
const rulesOpen = popup.rulesOpen;

/** 设置或规则全屏层任一打开时隐藏主界面并扩展视口 */
const manageOverlayOpen = computed(
  () => settingOpen.value || rulesOpen.value,
);

const { api, host: feedbackHost } = createFeedback();
provide(FEEDBACK_KEY, api);
provide(POPUP_CORE_KEY, popup);

/** 全屏层开关由 App 统一处理，避免多个 dialog 各自 toggle manage-mode */
watch(manageOverlayOpen, (on) => setManageMode(on));

/** DOM 就绪后拉取规则与 tab URL，不在 setup 顶层阻塞首屏 */
onMounted(() => {
  void popup.initPopup();
});
</script>

<style src="./popup-global.css"></style>
<style scoped>
.bh-container {
  width: 520px;
  box-sizing: border-box;
  padding: 14px 16px 16px;
}
.bh-container.is-managing {
  position: relative;
  width: 100%;
  min-height: 560px;
  max-height: 600px;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>