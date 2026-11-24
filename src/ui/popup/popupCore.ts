import { computed, ref, watch, type ComputedRef, type InjectionKey, type Ref } from "vue";
import type { PopupConfigsSnapshot } from "@/messaging/types";
import { pickEditingConfigId } from "@/shared/utils/rules";
import type { HeaderConfigData } from "@/types";
import { sendRuntimeMessage } from "./runtime";

/** Popup 与各子组件共享的响应式根状态（由 App provide） */
export interface PopupCoreContext {
  configs: Ref<HeaderConfigData[]>;
  activeId: Ref<string | null>;
  currentTabUrl: Ref<string>;
  settingOpen: Ref<boolean>;
  rulesOpen: Ref<boolean>;
  activeConfig: ComputedRef<HeaderConfigData | null>;
  globallyEnabled: ComputedRef<boolean>;
  syncActiveEditingId: () => void;
}

export const POPUP_CORE_KEY: InjectionKey<PopupCoreContext> = Symbol("popupCore");

export type PopupCore = PopupCoreContext & { initPopup: () => Promise<void> };

/**
 * 创建 Popup 界面状态。规则是否生效由各条 config.enabled 表示；
 * 此处只拉快照、记当前标签 URL，并维护正在编辑的规则 id。
 */
export function createPopupCore(): PopupCore {
  const configs = ref<HeaderConfigData[]>([]);
  const activeId = ref<string | null>(null);
  const currentTabUrl = ref("");
  const settingOpen = ref(false);
  const rulesOpen = ref(false);

  /** 与 activeId 对应的规则；id 失效时回退列表首条，供 HeaderRows 编辑 */
  const activeConfig = computed(() => {
    const id = activeId.value;
    return configs.value.find((c) => c.id === id) || configs.value[0] || null;
  });

  /** 任意规则 enabled 为 true 表示扩展处于 Resume */
  const globallyEnabled = computed(() => configs.value.some((c) => !!c.enabled));

  /**
   * 按当前列表和标签 URL 纠正 activeId。
   * 规则增删或 headers 变更后由 watch 调用。
   */
  function syncActiveEditingId() {
    activeId.value = pickEditingConfigId({
      configs: configs.value,
      activeId: activeId.value,
      tabUrl: currentTabUrl.value,
    });
  }

  /**
   * 向 background 拉取规则快照，失败时短暂重试。
   */
  async function loadSnapshot() {
    for (let i = 0; i < 3; i++) {
      try {
        const res = await sendRuntimeMessage<PopupConfigsSnapshot>("getConfigs");
        if (res.success && res.data) {
          configs.value = res.data.configs || [];
          return;
        }
      } catch {
        // Service Worker 尚未就绪
      }
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  /**
   * 读取当前窗口活动标签 URL，供自动规则匹配展示。
   */
  async function refreshCurrentTabUrl() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      currentTabUrl.value = tab?.url || "";
    } catch {
      currentTabUrl.value = "";
    }
  }

  /**
   * Popup 挂载入口：拉快照、校正编辑项、刷新标签 URL，并通知 background 同步 DNR。
   */
  async function initPopup() {
    await loadSnapshot();
    await refreshCurrentTabUrl();
    syncActiveEditingId();
    try {
      await sendRuntimeMessage("refreshRules");
    } catch {
      // ignore
    }
  }

  watch(configs, () => syncActiveEditingId(), { deep: true });

  return {
    configs,
    activeId,
    currentTabUrl,
    settingOpen,
    rulesOpen,
    activeConfig,
    globallyEnabled,
    syncActiveEditingId,
    initPopup,
  };
}
