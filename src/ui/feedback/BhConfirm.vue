
<template>
  <Transition name="bh-confirm">
    <div
      v-if="open"
      class="bh-confirm-backdrop"
      role="presentation"
      @click.self="emit('cancel')"
    >
      <div
        class="bh-confirm-panel"
        role="alertdialog"
        :aria-labelledby="title ? 'bh-confirm-title' : undefined"
        aria-describedby="bh-confirm-desc"
      >
        <h3 v-if="title" id="bh-confirm-title" class="bh-confirm-title">{{ title }}</h3>
        <p id="bh-confirm-desc" class="bh-confirm-message">{{ message }}</p>
        <div class="bh-confirm-actions">
          <button type="button" class="bh-btn" @click="emit('cancel')">
            {{ cancelText }}
          </button>
          <button
            type="button"
            class="bh-btn"
            :class="danger ? 'bh-btn-danger' : 'bh-btn-primary'"
            @click="emit('confirm')"
          >
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
  }>(),
  {
    title: "确认",
    confirmText: "确定",
    cancelText: "取消",
    danger: false,
  },
);

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>

<style scoped>

/* Confirm */
.bh-confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.45);
  box-sizing: border-box;
}
.bh-confirm-panel {
  width: 100%;
  max-width: 320px;
  padding: 16px;
  background: var(--bh-bg);
  border: 1px solid var(--bh-border);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18);
}
.bh-confirm-title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
}
.bh-confirm-message {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--bh-muted);
}
.bh-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
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
.bh-btn-primary {
  border-color: var(--bh-brand);
  color: var(--bh-brand);
  background: #faf5ff;
}
.bh-btn-primary:hover {
  background: #f5f3ff;
}
.bh-btn-danger {
  border-color: #fecaca;
  color: var(--bh-danger);
  background: #fff;
}
.bh-btn-danger:hover {
  background: #fee2e2;
}
.bh-confirm-enter-active,
.bh-confirm-leave-active {
  transition: opacity 0.15s ease;
}
.bh-confirm-enter-active .bh-confirm-panel,
.bh-confirm-leave-active .bh-confirm-panel {
  transition: transform 0.15s ease;
}
.bh-confirm-enter-from,
.bh-confirm-leave-to {
  opacity: 0;
}
.bh-confirm-enter-from .bh-confirm-panel,
.bh-confirm-leave-to .bh-confirm-panel {
  transform: scale(0.96);
}
</style>