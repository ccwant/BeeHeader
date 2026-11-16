import { computed, ref, watch, type ComputedRef, type InjectionKey, type Ref } from "vue";
import { Config } from "@/shared/models/Config";
import { isAutoRuleScope, isManualRuleScope, isUrlMatchingScope } from "@/shared/utils/rules";
import type { HeaderConfigData } from "@/types";
import { sendRuntimeMessage } from "./runtime";

/** Popup 与各子组件共享的响应式根状态（由 App provide） */
export interface PopupCoreContext {
  configs: Ref<HeaderConfigData[]>;
  activeId: Ref<string | null>;
  manualActiveId: Ref<string | null>;
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
 * 创建 Popup 全局状态容器。
 * 注册 configs 深度 watch，供 App `provide(POPUP_CORE_KEY)`；`initPopup` 由 App onMounted 调用。
 */
export function createPopupCore(): PopupCore {
  const configs = ref<HeaderConfigData[]>([]);
  const activeId = ref<string | null>(null);
  const manualActiveId = ref<string | null>(null);
  const currentTabUrl = ref("");
  const settingOpen = ref(false);
  const rulesOpen = ref(false);

  /** 与 activeId 对应、用于编辑 headers 的那条规则；无效 id 时回退列表首条 */
  const activeConfig = computed(() => {
    const id = activeId.value;
    return configs.value.find((c) => c.id === id) || configs.value[0] || null;
  });

  /** 任意规则 enabled 为 true 时表示扩展处于 Resume，DNR 可注入 */
  const globallyEnabled = computed(() => configs.value.some((c) => !!c.enabled));

  const autoConfigs = computed(() => configs.value.filter((c) => isAutoRuleScope(c.scope)));

  const manualConfigs = computed(() =>
    configs.value.filter((c) => isManualRuleScope(c.scope)),
  );

  /** 当前标签页 URL 能命中的自动规则，用于默认选中编辑项 */
  const matchedAutoConfigs = computed(() => {
    const url = currentTabUrl.value;
    if (!url) return [];
    return autoConfigs.value.filter((c) => isUrlMatchingScope(url, c.scope!));
  });

  /**
   * 修正 activeId，避免指向已删除规则。
   * 优先级：当前仍有效 → 自动命中 → 已勾选手动 → 手动列表首条 → 任意首条。
   */
  function syncActiveEditingId() {
    if (activeId.value && configs.value.some((c) => c.id === activeId.value)) return;
    const matched = matchedAutoConfigs.value;
    if (matched.length > 0) {
      activeId.value = matched[0].id ?? null;
      return;
    }
    if (
      manualActiveId.value &&
      manualConfigs.value.some((c) => c.id === manualActiveId.value)
    ) {
      activeId.value = manualActiveId.value;
      return;
    }
    activeId.value = manualConfigs.value[0]?.id ?? configs.value[0]?.id ?? null;
  }

  /**
   * 从 chrome.storage.local 恢复 manualEffectiveId 到 manualActiveId。
   * ID 无效时移除 storage 并 refreshRules，避免脏状态继续注入。
   */
  async function loadManualEffectiveFromStorage() {
    let storedId: string | null = null;
    try {
      const stored = await chrome.storage.local.get("manualEffectiveId");
      const raw = stored?.manualEffectiveId;
      if (typeof raw === "string" && raw) storedId = raw;
    } catch {
      // ignore
    }

    const valid =
      storedId && configs.value.some((c) => c.id === storedId && isManualRuleScope(c.scope));

    if (valid) {
      manualActiveId.value = storedId;
      return;
    }

    manualActiveId.value = null;
    if (storedId) {
      try {
        await chrome.storage.local.remove("manualEffectiveId");
        await sendRuntimeMessage("refreshRules");
      } catch {
        // ignore
      }
    }
  }

  /**
   * 仅用于首次安装默认规则：勾选默认手动规则并写入 storage。
   * 常规手动勾选由 RulesBlock.setManualEffective 处理。
   */
  async function setManualEffectiveForBootstrap(id: string, checked: boolean) {
    const config = configs.value.find((c) => c.id === id);
    if (!config || !isManualRuleScope(config.scope)) return;

    if (checked) manualActiveId.value = id;
    else if (manualActiveId.value === id) manualActiveId.value = null;
    else return;

    if (manualActiveId.value) {
      await chrome.storage.local.set({ manualEffectiveId: manualActiveId.value });
    } else {
      await chrome.storage.local.remove("manualEffectiveId");
    }
  }

  /**
   * Popup 首次加载规则：重试 getConfigs；无数据则 addConfig 默认手动规则并勾选。
   * 有数据时走 loadManualEffectiveFromStorage，最后 syncActiveEditingId。
   */
  async function ensureConfigs() {
    let list: HeaderConfigData[] = [];
    for (let i = 0; i < 3; i++) {
      try {
        const res = await sendRuntimeMessage<Config[]>("getConfigs");
        list = (res.data as HeaderConfigData[]) || [];
        if (list.length > 0) break;
      } catch {
        // ignore
      }
      await new Promise((r) => setTimeout(r, 120));
    }

    if (list.length === 0) {
      const create = await sendRuntimeMessage<HeaderConfigData>("addConfig", {
        name: "Default",
        enabled: true,
        headers: [],
        scope: { type: "all", value: "" },
      });
      if (create.success && create.data) {
        configs.value = [create.data as HeaderConfigData];
      } else {
        configs.value = [
          {
            id: "local_default",
            name: "Default",
            enabled: true,
            headers: [],
            scope: { type: "all", value: "" },
          },
        ];
      }
      const defaultId = configs.value[0]?.id ?? null;
      if (defaultId) await setManualEffectiveForBootstrap(defaultId, true);
    } else {
      configs.value = list;
      await loadManualEffectiveFromStorage();
    }

    syncActiveEditingId();
  }

  /**
   * 读取当前窗口活动标签的 URL，写入 currentTabUrl 供自动规则匹配 UI 使用。
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
   * Popup 挂载后入口：拉配置、刷新 tab URL、通知 background 同步 DNR。
   */
  async function initPopup() {
    await ensureConfigs();
    await refreshCurrentTabUrl();
    try {
      await sendRuntimeMessage("refreshRules");
    } catch {
      // ignore
    }
  }

  /** 规则集变化后自动纠正 activeId，防止列表与编辑区错位 */
  watch(configs, () => syncActiveEditingId(), { deep: true });

  const core: PopupCoreContext = {
    configs,
    activeId,
    manualActiveId,
    currentTabUrl,
    settingOpen,
    rulesOpen,
    activeConfig,
    globallyEnabled,
    syncActiveEditingId,
  };

  return Object.assign(core, { initPopup });
}
