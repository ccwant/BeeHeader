import { inject, onUnmounted, ref, type InjectionKey } from "vue";

export interface FeedbackConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

/** 子组件 inject 后仅调用 showToast / showConfirm */
export interface FeedbackApi {
  showToast: (message: string, durationMs?: number) => void;
  showConfirm: (options: FeedbackConfirmOptions) => Promise<boolean>;
}

export const FEEDBACK_KEY: InjectionKey<FeedbackApi> = Symbol("feedback");

/** FeedbackHost 绑定 BhToast / BhConfirm 用的响应式状态与事件 */
export interface FeedbackHostView {
  toastMessage: import("vue").Ref<string>;
  toastVisible: import("vue").Ref<boolean>;
  confirmOpen: import("vue").Ref<boolean>;
  confirmTitle: import("vue").Ref<string>;
  confirmMessage: import("vue").Ref<string>;
  confirmConfirmText: import("vue").Ref<string>;
  confirmCancelText: import("vue").Ref<string>;
  confirmDanger: import("vue").Ref<boolean>;
  onConfirmOk: () => void;
  onConfirmCancel: () => void;
}

/**
 * 创建 Popup 全局 Toast/Confirm 状态与 API。
 * 在 App setup 中调用：provide(FEEDBACK_KEY, api)，并将 host 传给 FeedbackHost。
 */
export function createFeedback(): { api: FeedbackApi; host: FeedbackHostView } {
  const toastMessage = ref("");
  const toastVisible = ref(false);
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  const confirmOpen = ref(false);
  const confirmTitle = ref("确认");
  const confirmMessage = ref("");
  const confirmConfirmText = ref("确定");
  const confirmCancelText = ref("取消");
  const confirmDanger = ref(false);
  let confirmResolver: ((value: boolean) => void) | null = null;

  /**
   * 底部轻提示，默认 2 秒后自动隐藏；重复调用会重置定时器。
   */
  function showToast(message: string, durationMs = 2000) {
    toastMessage.value = message;
    toastVisible.value = true;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastVisible.value = false;
    }, durationMs);
  }

  /**
   * 打开确认框；用户点确定、取消或遮罩时 resolve 对应布尔值。
   */
  function showConfirm(options: FeedbackConfirmOptions): Promise<boolean> {
    confirmTitle.value = options.title ?? "确认";
    confirmMessage.value = options.message;
    confirmConfirmText.value = options.confirmText ?? "确定";
    confirmCancelText.value = options.cancelText ?? "取消";
    confirmDanger.value = !!options.danger;
    confirmOpen.value = true;
    return new Promise((resolve) => {
      confirmResolver = resolve;
    });
  }

  /** BhConfirm 回调：关闭弹窗并结束 showConfirm 的 Promise */
  function resolveConfirm(ok: boolean) {
    confirmOpen.value = false;
    confirmResolver?.(ok);
    confirmResolver = null;
  }

  function onConfirmOk() {
    resolveConfirm(true);
  }

  function onConfirmCancel() {
    resolveConfirm(false);
  }

  onUnmounted(() => {
    if (toastTimer) clearTimeout(toastTimer);
    if (confirmResolver) {
      confirmResolver(false);
      confirmResolver = null;
    }
  });

  const api: FeedbackApi = { showToast, showConfirm };

  const host: FeedbackHostView = {
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
  };

  return { api, host };
}

/**
 * 在 App provide(FEEDBACK_KEY) 之下的子组件中调用 Toast / Confirm。
 */
export function useFeedback(): FeedbackApi {
  const api = inject(FEEDBACK_KEY);
  if (!api) {
    throw new Error("useFeedback requires FEEDBACK_KEY from App setup");
  }
  return api;
}