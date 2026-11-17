import { ConfigService } from "@/shared/services/ConfigService";
import { ValidationUtils } from "@/shared/utils/validation";
import type {
  ImportConfigsPayload,
  ImportSharedKVPayload,
  PopupConfigsSnapshot,
  RuntimeMessage,
  RuntimeResponse,
  SetGlobalEnabledPayload,
  UpdateConfigPayload,
} from "@/messaging/types";
import type { HeaderConfigData, HeaderItem } from "@/types";
import { Config } from "@/shared/models/Config";

class BackgroundService {
  private configService = new ConfigService();
  private readyPromise: Promise<void> | null = null;
  private _ruleRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  async init() {
    try {
      this.readyPromise = this.configService.init();
      await this.readyPromise;
      this.setupEventListeners();
      try {
        await this.configService.updateNetworkRules();
      } catch (e) {
        console.warn(
          "Initial rule sync failed (will retry on changes):",
          (e as Error)?.message || e,
        );
      }
      await this.updateActionState();
      console.log("BeeHeader background started");
    } catch (error) {
      console.error("Background init failed:", error);
    }
  }

  setupEventListeners() {
    // 安装时创建默认配置
    chrome.runtime.onInstalled.addListener((details) => {
      console.log("[BeeHeader]安装", details);
      void this.handleInstall(details);
    });
    // 处理消息
    chrome.runtime.onMessage.addListener(
      (message: RuntimeMessage, _sender, sendResponse) => {
        console.log("[BeeHeader]处理消息", message);
        void this.handleMessage(message, sendResponse);
        return true;
      },
    );
    // 监听配置变化
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace !== "local") return;
      if (changes.configs) {
        console.log("[BeeHeader]配置变化", changes);
        void this.handleConfigsChanged();
      } else if (changes.manualEffectiveId) {
        console.log("[BeeHeader]配置变化 手动", changes);
        void this.handleConfigsChanged();
      }
    });
    // 监听标签页更新
    chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
      if (changeInfo.url || changeInfo.status === "complete") {
        console.log("[BeeHeader]标签页更新", tab);
        console.log("当前 URL:", tab.url);
        this.configService.setCurrentTabId(_tabId);
        this.scheduleRuleRefresh();
        if (tab?.url) void this.updateBadgeForTab(tab);
      }
    });
    // 监听标签页切换
    chrome.tabs.onActivated.addListener((activeInfo) => {
      console.log("[BeeHeader]标签页切换", activeInfo);
      chrome.tabs.get(activeInfo.tabId, (tab) => {
        console.log("当前 URL:", tab.url);
        this.configService.setCurrentTabId(activeInfo.tabId);
        this.scheduleRuleRefresh();
        if (tab?.url) void this.updateBadgeForTab(tab);
      });
    });
    // 监听标签页移除
    chrome.tabs.onRemoved.addListener(() => {
      console.log("[BeeHeader]标签页移除");
      this.scheduleRuleRefresh();
    });
  }

  scheduleRuleRefresh() {
    if (this._ruleRefreshTimer) clearTimeout(this._ruleRefreshTimer);
    // 定时刷新规则
    this._ruleRefreshTimer = setTimeout(() => {
      this.configService.updateNetworkRules().catch((e) => {
        console.warn(
          "Rule refresh after tab change failed:",
          (e as Error)?.message || e,
        );
      });
    }, 120);
  }

  async handleInstall(details: { reason?: string }) {
    if (details.reason === "install") {
      try {
        await this.createDefaultConfig();
      } catch (error) {
        console.error("Failed to create default config:", error);
      }
    }
  }

  async createDefaultConfig() {
    await this.configService.ensureDefaultConfig();
  }

  async handleMessage(
    message: RuntimeMessage,
    sendResponse: (response: RuntimeResponse) => void,
  ) {
    try {
      if (this.readyPromise) {
        await this.readyPromise.catch(() => {});
      }
      const { action, data } = message;

      switch (action) {
        case "getConfigs": {
          await this.configService.ensureDefaultConfig();
          const snapshot: PopupConfigsSnapshot = {
            configs: this.configService.getAllConfigs().map((c) => c.toJSON()),
            manualEffectiveId: await this.configService.resolveManualEffectiveId(),
          };
          sendResponse({ success: true, data: snapshot });
          break;
        }

        case "addConfig": {
          const newConfig = await this.configService.addConfig(
            data as HeaderConfigData,
          );
          sendResponse({ success: true, data: newConfig });
          break;
        }

        case "updateConfig": {
          const payload = data as UpdateConfigPayload;
          const updatedConfig = await this.configService.updateConfig(
            payload.id,
            payload.config,
          );
          sendResponse({ success: true, data: updatedConfig });
          break;
        }

        case "toggleConfig": {
          const payload = data as { id: string; enabled: boolean };
          const toggledConfig = await this.configService.toggleConfig(
            payload.id,
            payload.enabled,
          );
          await this.updateActionState();
          sendResponse({ success: true, data: toggledConfig });
          break;
        }

        case "setGlobalEnabled": {
          const payload = data as SetGlobalEnabledPayload;
          await this.configService.setGlobalEnabled(!!payload.enabled);
          await this.updateActionState();
          const snapshot: PopupConfigsSnapshot = {
            configs: this.configService.getAllConfigs().map((c) => c.toJSON()),
            manualEffectiveId: await this.configService.resolveManualEffectiveId(),
          };
          sendResponse({ success: true, data: snapshot });
          break;
        }

        case "deleteConfig": {
          const payload = data as { id: string };
          await this.configService.deleteConfig(payload.id);
          await this.updateActionState();
          sendResponse({
            success: true,
            data: this.configService.getAllConfigs(),
          });
          break;
        }

        case "refreshRules":
          await this.configService.loadConfigs();
          await this.configService.updateNetworkRules();
          await this.updateActionState();
          sendResponse({ success: true });
          break;

        case "importConfigs": {
          const payload = data as ImportConfigsPayload;
          const list = Array.isArray(payload?.configs) ? payload.configs : [];
          if (list.length === 0) {
            sendResponse({ success: false, error: "没有可导入的规则" });
            break;
          }
          console.log("[BeeHeader]导入规则", list);
          await this.configService.importConfigs(list);
          await this.updateActionState();
          sendResponse({
            success: true,
            data: this.configService.getAllConfigs(),
          });
          break;
        }

        case "importSharedKV": {
          const payload = data as ImportSharedKVPayload;
          const list = Array.isArray(payload?.h) ? payload.h : [];
          const candidate: HeaderItem[] = list
            .filter(
              (it): it is [unknown, unknown] =>
                Array.isArray(it) && !!String(it[0] || "").trim(),
            )
            .map(([n, v]) => ({
              name: String(n).trim(),
              value: String(v ?? ""),
              enabled: true,
              type: "request" as const,
            }));

          if (candidate.length === 0) {
            sendResponse({
              success: false,
              error: "No valid headers in shared link",
            });
            break;
          }

          const bad: string[] = [];
          candidate.forEach((h, i) => {
            if (!/^[a-zA-Z0-9!#$&'*+.^_`|~-]+$/.test(h.name)) {
              bad.push(`#${i + 1} "${h.name}": invalid header name`);
            }
            const valErrs = ValidationUtils.validateHeaderValue(h.value);
            if (valErrs.length)
              bad.push(`#${i + 1} "${h.name}": ${valErrs.join(", ")}`);
          });
          if (bad.length) {
            sendResponse({
              success: false,
              error: "Rejected unsafe headers: " + bad.join("; "),
            });
            break;
          }

          let configs = this.configService.getAllConfigs();
          if (!configs || configs.length === 0) {
            await this.configService.addConfig({
              name: "Default",
              enabled: false,
              headers: [],
              scope: { type: "all", value: "" },
            });
            configs = this.configService.getAllConfigs();
          }
          const first = configs[0];
          const updated = await this.configService.updateConfig(first.id, {
            headers: candidate,
            enabled: true,
          });
          try {
            await this.configService.updateNetworkRules();
          } catch {
            // ignore
          }
          await this.updateActionState();
          sendResponse({ success: true, data: updated });
          break;
        }

        default:
          sendResponse({ success: false, error: `Unknown action: ${action}` });
      }
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async handleConfigsChanged() {
    await this.configService.loadConfigs();
    try {
      await this.configService.updateNetworkRules();
    } catch (e) {
      console.warn(
        "Rule update after change failed:",
        (e as Error)?.message || e,
      );
    }
    await this.updateActionState();
    await this.updateBadgeForCurrentTab();
  }

  async updateBadgeForTab(tab: chrome.tabs.Tab) {
    if (!tab?.id || !tab.url) return;
    const entries = await this.configService.getEnabledConfigs({ tabs: [tab] });
    this.updateBadge(tab.id, entries.length);
  }

  async updateBadgeForCurrentTab() {
    if (this.configService.getCurrentTabId() === -1) return;
    chrome.tabs.get(this.configService.getCurrentTabId(), (tab) => {
      if (tab?.url) void this.updateBadgeForTab(tab);
    });
  }

  updateBadge(tabId: number, count: number) {
    if (count > 0) {
      chrome.action.setBadgeText({ text: count.toString(), tabId });
      chrome.action.setBadgeBackgroundColor({ color: "#4CAF50", tabId });
    } else {
      chrome.action.setBadgeText({ text: "", tabId });
    }
  }

  async updateActionState() {
    try {
      const configs = this.configService.getAllConfigs();
      const enabledHeadersCount = configs
        .filter((c) => c.enabled)
        .flatMap((c) => c.headers || [])
        .filter(
          (h) => h && h.enabled !== false && (h.name || "").trim(),
        ).length;

      const isActive = enabledHeadersCount > 0;
      const title = isActive
        ? `BeeHeader — Active (${enabledHeadersCount} headers)`
        : "BeeHeader — Ready (add a header)";
      await chrome.action.setTitle({ title });

      const basePath = "icons";
      const paths = isActive
        ? {
            16: `${basePath}/icon16.png`,
            32: `${basePath}/icon32.png`,
            48: `${basePath}/icon48.png`,
            128: `${basePath}/icon128.png`,
          }
        : {
            16: `${basePath}/icon16_gray.png`,
            32: `${basePath}/icon32_gray.png`,
            48: `${basePath}/icon48_gray.png`,
            128: `${basePath}/icon128_gray.png`,
          };
      await chrome.action.setIcon({ path: paths });
    } catch (e) {
      console.warn("updateActionState failed:", (e as Error)?.message || e);
    }
  }
}

const backgroundService = new BackgroundService();
backgroundService.init();

export { Config, ConfigService };
