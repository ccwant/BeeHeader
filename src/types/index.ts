export type HeaderType = "request" | "response";

export interface HeaderItem {
  name: string;
  value: string;
  type: HeaderType;
  enabled: boolean;
}

export type ScopeType = "all" | "regex" | "domain" | "url_prefix" | "prefix";

export interface ConfigScope {
  type: ScopeType;
  value: string;
}

export interface HeaderConfigData {
  id?: string;
  name?: string;
  enabled?: boolean;
  headers?: HeaderItem[];
  scope?: ConfigScope;
  createdAt?: number;
  updatedAt?: number;
}
