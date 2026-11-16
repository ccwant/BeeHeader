<template>
  <div class="bh-feedback-root">
    <slot />
    <BhToast :message="toastMessage" :visible="toastVisible" />
    <BhConfirm
      :open="confirmOpen"
      :title="confirmTitle"
      :message="confirmMessage"
      :confirm-text="confirmConfirmText"
      :cancel-text="confirmCancelText"
      :danger="confirmDanger"
      @confirm="onConfirmOk"
      @cancel="onConfirmCancel"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 挂载 Toast/Confirm UI；状态与 API 由 App 侧 createFeedback 创建并 provide。
 */
import BhToast from "./BhToast.vue";
import BhConfirm from "./BhConfirm.vue";
import type { FeedbackHostView } from "./useFeedback";

const props = defineProps<{
  host: FeedbackHostView;
}>();

const {
  toastMessage,
  toastVisible,
  confirmOpen,
  confirmTitle,
  confirmMessage,
  confirmConfirmText,
  confirmCancelText,
  confirmDanger,
  onConfirmOk,
  onConfirmCancel,
} = props.host;
</script>

<style scoped>
.bh-feedback-root {
  display: contents;
}
</style>