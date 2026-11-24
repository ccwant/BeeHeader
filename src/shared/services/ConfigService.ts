/**
 * ConfigService — 配置持久化 + Declarative Net Request (DNR) 规则同步。
 *
 * 职责概览：
 * 1. 读写 chrome.storage 中的规则集（`configs`）。每条规则的 `enabled` 表示是否参与注入。
 * 2. 将已启用的 header 配置编译为 MV3 DNR 的 `modifyHeaders` 规则。
 * 3. 区分手动规则（无 URL / 全匹配）与自动规则（带 URL 作用域），分别使用
 *    动态规则（dynamic）与会话规则（session + tabIds）。
 *
 * 请求头实际改写在浏览器网络栈完成，扩展不拦截每个请求的 webRequest。
 *
 * @see https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest
 */
import { Config } from "@/shared/models/Config";
import type { ConfigScope, HeaderConfigData } from "@/types";
import {
  isManualRuleScope,
  isUrlMatchingScope as matchUrlToScope,
} from "@/shared/utils/rules";
import { StorageService } from "@/shared/utils/storage";
import { ValidationUtils } from "@/shared/utils/validation";

/** DNR 侧一条待编译配置：无 tabIds = 动态规则（手动）；有 tabIds = 会话规则（自动） */
export type EnabledConfigEntry = {
  config: Config;
  tabIds?: number[];
};

/**
 * DNR 规则 `condition.resourceTypes` 白名单。
 * 仅这些类型的请求会套用到 header 修改；未列入的类型不受影响。
 */
export const RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
  "xmlhttprequest",
  "websocket",
  "other",
  "ping",
] as const;

export class ConfigService {
  private storage = new StorageService();
  /** 内存中的规则集，与 storage `configs` 同步 */
  private configs: Config[] = [];
  /**
   * DNR 更新串行化：避免并发 `updateDynamicRules` / `updateSessionRules`
   * 导致规则 ID 冲突或 add/remove 竞态。
   */
  private _ruleUpdatePromise: Promise<void> = Promise.resolve();

  private currentTabId: number = -1;

  /** 启动时从 storage 加载规则集，并清掉已废弃的 manualEffectiveId */
  async init() {
    await this.loadConfigs();
  }

  async loadConfigs() {
    try {
      const data = await this.storage.get<HeaderConfigData[]>("configs");
      this.configs = (data || []).map((configData) =>
        Config.fromJSON(configData),
      );
    } catch (error) {
      console.error("Failed to load configs:", error);
      this.configs = [];
    }
  }

  async saveConfigs() {
    const configsData = this.configs.map((config) => config.toJSON());
    await this.storage.set("configs", configsData);
  }

  getAllConfigs() {
    return this.configs;
  }

  getConfigById(id: string) {
    return this.configs.find((config) => config.id === id);
  }

  getCurrentTabId() {
    return this.currentTabId;
  }

  async addConfig(configData: HeaderConfigData) {
    const config = new Config(configData);
    this.configs.push(config);
    await this.saveConfigs();
    return config;
  }

  /** 批量导入规则（追加），完成后刷新 DNR */
  async importConfigs(items: HeaderConfigData[]) {
    const extensionRunning = this.configs.some((c) => c.enabled);
    const created: Config[] = [];
    for (const item of items) {
      const config = new Config({
        ...item,
        enabled: extensionRunning,
      });
      created.push(config);
    }
    if (created.length > 0) {
      this.configs.push(...created);
      await this.saveConfigs();
      await this.updateNetworkRules();
    }
    return created;
  }

  async updateConfig(id: string, configData: HeaderConfigData) {
    const configIndex = this.configs.findIndex((config) => config.id === id);
    if (configIndex === -1) {
      throw new Error("Config not found");
    }

    const updatedConfig = new Config({
      ...this.configs[configIndex].toJSON(),
      ...configData,
    });
    this.configs[configIndex] = updatedConfig;
    await this.saveConfigs();
    return updatedConfig;
  }

  async setCurrentTabId(tabId: number) {
    this.currentTabId = tabId;
  }

  /**
   * 只改一条规则的 enabled，并重建 DNR。勾选框走这条，不改其它规则。
   */
  async toggleConfig(id: string, enabled: boolean) {
    const updated = await this.updateConfig(id, { enabled });
    await this.updateNetworkRules();
    return updated;
  }

  /**
   * 规则集为空时创建一条默认启用的手动规则。
   * 安装与 Popup 拉配置时共用。
   */
  async ensureDefaultConfig() {
    if (this.configs.length > 0) return;
    await this.addConfig({
      name: "Default",
      enabled: true,
      headers: [],
      scope: { type: "all", value: "" },
    });
  }

  lastGlobalEnabled: Record<string, boolean> = {};
  /**
   * 全局 Pause / Resume：把每条规则的 enabled 设成同一值后重建 DNR。
   * 单条勾选不走这里。
   */
  async setGlobalEnabled(enabled: boolean) {
    if (enabled) {
      for (const config of this.configs) {
        config.setEnabled(this.lastGlobalEnabled[config.id] ?? false);
      }
    } else {
      for (const config of this.configs) {
        this.lastGlobalEnabled[config.id] = config.enabled;
        config.setEnabled(false);
      }
    }
    
    await this.saveConfigs();
    await this.updateNetworkRules();
  }

  async deleteConfig(id: string) {
    const before = this.configs.length;
    this.configs = this.configs.filter((config) => config.id !== id);
    if (this.configs.length === before) {
      throw new Error("Config not found");
    }
    await this.saveConfigs();
    await this.updateNetworkRules();
    return true;
  }

  async getTabs(tabs?: chrome.tabs.Tab[]): Promise<chrome.tabs.Tab[]> {
    if (tabs) return Promise.resolve(tabs);
    try {
      return chrome.tabs.query({});
    } catch (e) {
      console.warn(
        "tabs.query failed; patterned rules may be empty:",
        (e as Error)?.message || e,
      );
      return Promise.resolve([]);
    }
  }

  /**
   * 汇总「当前应生效」的配置：Pause/Resume、手动勾选、自动 URL 与 tab 匹配均在此处理。
   *
   * `tabs` 默认为当前窗口全部标签；传 `[tab]` 可等价于「该 tab 的徽章 / 单页视角」。
   * 返回 DNR 编译用的 `{ config, tabIds? }[]`（手动无 tabIds，自动带命中的 tabIds）。
   */
  async getEnabledConfigs(options?: {
    tabs?: chrome.tabs.Tab[];
  }): Promise<EnabledConfigEntry[]> {
    console.log("[BeeHeader]getEnabledConfigs options", options);
    let tabs = await this.getTabs(options?.tabs);
    console.log("[BeeHeader]getEnabledConfigs tabs", tabs);

    // 只保留 enabled 且至少有一条有效 header 的规则
    const allConfigs = this.configs.filter((c) => {
      if (!c.enabled) {
        return false;
      }
      if (!c.headers) {
        return false;
      }
      if (
        !c.headers.some((h) => h.enabled !== false && (h.name || "").trim())
      ) {
        return false;
      }
      return true;
    });

    const entries: EnabledConfigEntry[] = [];

    console.log("[BeeHeader]getEnabledConfigs allEnabledConfigs", allConfigs);
    for (const config of allConfigs) {
      // 手动规则无 tabIds
      if (isManualRuleScope(config.scope)) {
        entries.push({ config });
        continue;
      }
      // 自动规则根据 URL 匹配 tabIds
      const tabIds = tabs
        .filter(
          (t) =>
            t.id === this.currentTabId &&
            typeof t.id === "number" &&
            matchUrlToScope(t.url || "", config.scope!),
        )
        .map((t) => t.id!);
      // 如果命中了 tabIds，则添加到 entries
      if (tabIds.length > 0) {
        entries.push({ config, tabIds });
      }
    }
    console.log("[BeeHeader]getEnabledConfigs entries", entries);
    return entries;
  }

  /**
   * 作用域是否表示「匹配所有标签页」（与手动规则 UI 中 URL 留空 / * 等价）。
   * @deprecated 新业务逻辑优先使用 `isManualRuleScope`（与 Popup 分类一致）
   */
  isMatchAllScope(scope?: ConfigScope) {
    if (!scope || scope.type === "all") return true;
    if (scope.type === "regex") {
      const pattern = (scope.value || "").trim();
      return !pattern || pattern === "*";
    }
    return false;
  }

  /**
   * 标签页 URL 规范化：去掉 hash（SPA 路由在 hash 中，但匹配常以地址栏前缀为准）。
   */
  normalizeTabUrl(url: string) {
    if (!url) return "";
    return String(url).split("#")[0];
  }

  /** 生成带/不带尾部斜杠的 pattern 变体，减少用户粘贴 URL 时的误匹配 */
  patternVariants(pattern: string) {
    const p = (pattern || "").trim();
    if (!p) return [];
    const out = new Set([p]);
    if (p.endsWith("/")) out.add(p.slice(0, -1));
    else out.add(p + "/");
    return [...out];
  }

  /**
   * 判断浏览器**地址栏 URL** 是否命中某条规则的作用域（用于自动规则 + 徽章统计）。
   *
   * - `regex`：前缀匹配 + RegExp 尝试（对用户粘贴的路径较友好）
   * - `domain`：主机名精确或子域后缀
   * - `url_prefix` / `prefix`：URL 前缀
   *
   * 注：自动规则的 DNR 使用 tabIds 限定标签页，请求 URL 本身不在 condition 里过滤，
   * 以便该标签页内 SPA 发起的 XHR 仍能带上 header。
   */
  /** @deprecated 请优先使用 `@/shared/utils/scope` 的 `isUrlMatchingScope` */
  isUrlMatchingScope(url: string, scope: ConfigScope) {
    return matchUrlToScope(url, scope);
  }

  /**
   * 全量重建 declarativeNetRequest 动态规则与会话规则。
   *
   * 流程：
   * 1. `getEnabledConfigs({ tabs })` 完成手动/自动过滤与 URL-tab 匹配。
   * 2. 编译 dynamic / session 规则后整表替换 DNR（避免残留）。
   *
   * 标签页切换时 Background 会 debounce 再次调用本方法（见 background `scheduleRuleRefresh`）。
   */
  async updateNetworkRules() {
    console.log("[BeeHeader]更新网络规则");
    this._ruleUpdatePromise = this._ruleUpdatePromise.then(async () => {
      const tabs = await this.getTabs();

      const entries = await this.getEnabledConfigs({ tabs });

      // DNR 规则 ID 需在单次 update 批次内唯一
      let nextId = 1;
      const assignIds = <T extends { id: number }>(rules: T[]) =>
        rules.map((rule) => ({ ...rule, id: nextId++ }));

      const dynamicConfigs = entries
        .filter((e) => !e.tabIds?.length)
        .map((e) => e.config);
      const dynamicRules = assignIds(this.buildDnrRules(dynamicConfigs));

      const sessionRules: ReturnType<ConfigService["buildDnrRules"]> = [];
      for (const entry of entries) {
        if (!entry.tabIds?.length) continue;
        sessionRules.push(...this.buildDnrRules([entry.config], entry.tabIds));
      }
      const sessionRulesWithIds = assignIds(sessionRules);

      const existingDynamic =
        await chrome.declarativeNetRequest.getDynamicRules();
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingDynamic.map((rule) => rule.id),
        addRules: dynamicRules,
      });

      const existingSession =
        await chrome.declarativeNetRequest.getSessionRules();
      await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: existingSession.map((rule) => rule.id),
        addRules: sessionRulesWithIds,
      });
    });
    return this._ruleUpdatePromise;
  }

  /**
   * 将配置列表编译为 DNR `Rule[]`（每条启用的 header 一行规则）。
   *
   * @param enabledConfigs 应由 `getEnabledConfigs` 产出（过滤与匹配已完成）
   * @param tabIds 非空时写入 `condition.tabIds`（会话 / 自动规则）
   *
   * `action.type`: `modifyHeaders`
   * - `requestHeaders` + `operation: set` → 改写出站请求头
   * - `responseHeaders` → 改写响应头（header.type === 'response' 时）
   */
  buildDnrRules(enabledConfigs: Config[], tabIds?: number[]) {
    const rules: chrome.declarativeNetRequest.Rule[] = [];

    enabledConfigs.forEach((config) => {
      (config.headers || []).forEach((header, idx) => {
        if (!header || header.enabled === false) return;
        if (!ValidationUtils.isValidHeaderName(header.name || "")) return;
        if (ValidationUtils.validateHeaderValue(header.value ?? "").length > 0)
          return;

        const isResponse = header.type === "response";

        const condition: chrome.declarativeNetRequest.RuleCondition = {
          resourceTypes: [...RESOURCE_TYPES],
        };
        // Session 规则专属：按标签页隔离，不写 request.url 条件以便 SPA API 同 tab 生效
        if (tabIds && tabIds.length > 0) {
          condition.tabIds = tabIds;
        }

        const action: chrome.declarativeNetRequest.RuleAction = {
          type: "modifyHeaders",
        };
        if (isResponse) {
          action.responseHeaders = [
            {
              header: header.name,
              operation: "set",
              value: header.value ?? "",
            },
          ];
        } else {
          action.requestHeaders = [
            {
              header: header.name,
              operation: "set",
              value: header.value ?? "",
            },
          ];
        }

        rules.push({
          // 占位 ID；`updateNetworkRules` 中 `assignIds` 会重写为连续唯一 ID
          id: idx + 1,
          priority: 1,
          action,
          condition,
        });
      });
    });
    return rules;
  }
}
