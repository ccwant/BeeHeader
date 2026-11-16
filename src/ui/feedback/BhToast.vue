<template>
  <Transition name="bh-toast">
    <div v-if="visible" class="bh-toast" role="status" aria-live="polite">
      {{ message }}
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  message: string;
  visible: boolean;
}>();
</script>

<style scoped>

/* Toast */
.bh-toast {
  position: fixed;
  left: 50%;
  bottom: 20px;
  z-index: 10000;
  transform: translateX(-50%);
  max-width: calc(100% - 32px);
  padding: 10px 16px;
  font-size: 13px;
  color: #fff;
  background: rgba(15, 23, 42, 0.92);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.22);
  pointer-events: none;
}
.bh-toast-enter-active,
.bh-toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.bh-toast-enter-from,
.bh-toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}

</style>