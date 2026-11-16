import type { HeaderConfigData, HeaderItem } from "@/types";

export class Config {
  id: string;
  name: string;
  enabled: boolean;
  headers: HeaderItem[];
  scope: NonNullable<HeaderConfigData["scope"]>;
  createdAt: number;
  updatedAt: number;

  constructor(data: HeaderConfigData = {}) {
    this.id = data.id || this.generateId();
    this.name = data.name || "";
    this.enabled = data.enabled || false;
    this.headers = data.headers || [];
    this.scope = data.scope || { type: "all", value: "" };
    this.createdAt = data.createdAt || Date.now();
    this.updatedAt = data.updatedAt || Date.now();
  }

  generateId() {
    return "config_" + Date.now() + "_" + Math.random().toString(36).slice(2, 11);
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.updatedAt = Date.now();
  }

  toJSON(): HeaderConfigData & { id: string; createdAt: number; updatedAt: number } {
    return {
      id: this.id,
      name: this.name,
      enabled: this.enabled,
      headers: this.headers,
      scope: this.scope,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromJSON(data: HeaderConfigData) {
    return new Config(data);
  }
}
