import type { HeaderConfigData } from "@/types";

export type BackgroundAction =
  | "getConfigs"
  | "addConfig"
  | "updateConfig"
  | "toggleConfig"
  | "setGlobalEnabled"
  | "deleteConfig"
  | "refreshRules"
  | "importSharedKV"
  | "importConfigs";

export interface RuntimeMessage {
  action: BackgroundAction;
  data?: unknown;
}

export interface RuntimeResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface UpdateConfigPayload {
  id: string;
  config: Partial<HeaderConfigData>;
}

export interface DeleteConfigPayload {
  id: string;
}

export interface SetGlobalEnabledPayload {
  enabled: boolean;
}

export interface ImportSharedKVPayload {
  h: unknown[];
}

export interface ImportConfigsPayload {
  configs: HeaderConfigData[];
}
