import type { BackgroundAction, RuntimeResponse } from "@/messaging/types";

/**
 * Popup → Background Service Worker 统一消息入口（`RuntimeMessage` 协议）。
 */
export async function sendRuntimeMessage<T = unknown>(
  action: BackgroundAction,
  data?: unknown,
): Promise<RuntimeResponse<T>> {
  return chrome.runtime.sendMessage({ action, data });
}
