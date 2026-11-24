import type { ConfigScope, HeaderConfigData, HeaderItem } from "@/types";
import { ValidationUtils, type ValidationMessageKey } from "./validation";

// —— 手动 / 自动 ——
/** 未配置 URL 规则（* / 空）→ 手动规则 */
export function isManualRuleScope(scope?: ConfigScope): boolean {
  if (!scope || scope.type === "all") return true;
  if (scope.type === "regex") {
    const pattern = (scope.value || "").trim();
    return !pattern || pattern === "*";
  }
  return false;
}

export function isAutoRuleScope(scope?: ConfigScope): boolean {
  return !isManualRuleScope(scope);
}

// —— 表单 pattern ↔ scope ——
export function scopeToPattern(scope?: ConfigScope): string {
  if (!scope || scope.type === "all") return "";
  if (scope.type === "regex") {
    const v = (scope.value || "").trim();
    return !v || v === "*" ? "" : v;
  }
  return (scope.value || "").trim();
}

export function patternToScope(pattern: string): ConfigScope {
  const p = (pattern ?? "").trim();
  if (!p || p === "*") return { type: "all", value: "" };
  return { type: "regex", value: p };
}

// —— 展示标签 ——
export function getPatternLabel(config: HeaderConfigData): string {
  const scope = config.scope || { type: "all", value: "" };
  if (!scope.type || scope.type === "all") return "*";
  if (scope.type === "regex") {
    const v = (scope.value || "").trim();
    return !v || v === "*" ? "*" : v;
  }
  if (scope.type === "domain") return scope.value || "*";
  if (scope.type === "url_prefix" || scope.type === "prefix") {
    return scope.value ? `${scope.value}*` : "*";
  }
  return (scope.value || "").trim() || "*";
}

export function getRuleAlias(config: HeaderConfigData): string {
  const alias = (config.name || "").trim();
  if (!alias) return "";
  const pattern = getPatternLabel(config);
  if (alias === pattern) return "";
  return alias;
}

export function getTabLabel(config: HeaderConfigData): string {
  const name = (config.name || "").trim();
  if (name.length > 2) return name;
  return getRuleAlias(config) || getPatternLabel(config);
}

export type RulesImportError =
  | {
      key: "import.ruleLine";
      params: { index: number; reason: ValidationMessageKey };
    }
  | { key: "import.jsonInvalid" | "import.noRulesArray" | "import.fileEmpty" };

/**
 * 生成不重复的默认规则名；`format` 由 UI i18n 提供（如「新规则{n}」）。
 * 若 format 与 n 无关则设上限，避免死循环。
 */
export function nextDefaultRuleName(
  configs: HeaderConfigData[],
  format: (n: number) => string,
): string {
  const used = new Set(configs.map((c) => (c.name || "").trim()));
  let n = Math.max(1, configs.length);
  const maxTries = 10_000;
  let last = "";
  for (let i = 0; i < maxTries; i++) {
    n += 1;
    const name = format(n);
    if (!used.has(name)) return name;
    if (name === last) continue;
    last = name;
  }
  const fallback = `rule_${Date.now()}`;
  return used.has(fallback) ? `${fallback}_${n}` : fallback;
}

/**
 * 选择 Header 编辑区应绑定的规则 id。
 * 当前 id 仍在列表中则保持；否则优先当前页命中的自动规则，再已启用的手动规则，再任意手动或首条。
 */
export function pickEditingConfigId(input: {
  configs: HeaderConfigData[];
  activeId: string | null;
  tabUrl: string;
}): string | null {
  const { configs, activeId, tabUrl } = input;
  if (activeId && configs.some((c) => c.id === activeId)) return activeId;
  if (tabUrl) {
    const matched = configs.find(
      (c) => isAutoRuleScope(c.scope) && !!c.scope && isUrlMatchingScope(tabUrl, c.scope),
    );
    if (matched?.id) return matched.id;
  }
  const enabledManual = configs.find((c) => isManualRuleScope(c.scope) && c.enabled);
  return enabledManual?.id ?? configs.find((c) => isManualRuleScope(c.scope))?.id ?? configs[0]?.id ?? null;
}

// —— URL 与作用域匹配 ——
export function patternVariants(pattern: string) {
  const p = (pattern || "").trim();
  if (!p) return [];
  const out = new Set([p]);
  if (p.endsWith("/")) out.add(p.slice(0, -1));
  else out.add(p + "/");
  return [...out];
}

export function normalizeTabUrl(url: string) {
  if (!url) return "";
  return String(url).split("#")[0];
}

export function isUrlMatchingScope(url: string, scope: ConfigScope): boolean {
  try {
    if (!url) return false;
    if (isManualRuleScope(scope)) return true;

    if (scope.type === "regex") {
      const pattern = (scope.value || "").trim();
      const full = String(url);
      const noHash = normalizeTabUrl(full);
      const candidates = [full, noHash];

      for (const p of patternVariants(pattern)) {
        if (candidates.some((c) => c === p || c.startsWith(p))) return true;
        try {
          const re = new RegExp(p);
          if (candidates.some((c) => re.test(c))) return true;
        } catch {
          // invalid regex
        }
      }
      return false;
    }

    const urlObj = new URL(url);
    const noHash = normalizeTabUrl(url);

    if (scope.type === "domain") {
      return (
        urlObj.hostname === scope.value ||
        urlObj.hostname.endsWith("." + scope.value)
      );
    }

    if (scope.type === "url_prefix" || scope.type === "prefix") {
      const prefix = scope.value || "";
      return patternVariants(prefix).some(
        (p) => noHash.startsWith(p) || url.startsWith(p),
      );
    }

    return false;
  } catch {
    return false;
  }
}

// —— 导入 / 导出 ——
export const RULES_EXPORT_KIND = "beeHeaderRules" as const;
export const RULES_EXPORT_VERSION = 1 as const;

export interface RulesExportRule {
  name: string;
  pattern?: string;
  scope?: ConfigScope;
  headers?: HeaderItem[];
}

export interface RulesExportDocument {
  kind: typeof RULES_EXPORT_KIND;
  version: typeof RULES_EXPORT_VERSION;
  exportedAt: string;
  rules: RulesExportRule[];
}

export function ruleToExport(rule: HeaderConfigData): RulesExportRule {
  const name = (rule.name || "").trim();
  return {
    name,
    pattern: scopeToPattern(rule.scope),
    scope: rule.scope ? { ...rule.scope } : undefined,
    headers: (rule.headers || []).map((h) => ({ ...h })),
  };
}

export function buildRulesExportDocument(
  configs: HeaderConfigData[],
): RulesExportDocument {
  return {
    kind: RULES_EXPORT_KIND,
    version: RULES_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    rules: configs.map(ruleToExport),
  };
}

function normalizeHeaderItem(raw: any): HeaderItem {
  const type = raw.type === "response" ? "response" : "request";
  return {
    name: String(raw.name ?? "").trim(),
    value: String(raw.value ?? ""),
    type,
    enabled: raw.enabled !== false,
  };
}

function resolveImportScope(rule: RulesExportRule): ConfigScope {
  if (rule.scope && typeof rule.scope.type === "string") {
    return {
      type: rule.scope.type,
      value: String(rule.scope.value ?? ""),
    };
  }
  return patternToScope(rule.pattern ?? "");
}

function validateRule(rule: RulesExportRule, index: number): RulesImportError | null {
  const name = String(rule.name ?? "").trim();
  const aliasErr = ValidationUtils.validateRuleAlias(name);
  if (aliasErr) {
    return { key: "import.ruleLine", params: { index: index + 1, reason: aliasErr } };
  }
  if (Array.isArray(rule.headers)) {
    for (let i = 0; i < rule.headers.length; i++) {
      const itemErr = ValidationUtils.validateHeaderItem(rule.headers[i]);
      if (itemErr) {
        return { key: "import.ruleLine", params: { index: index + 1, reason: itemErr } };
      }
    }
  }
  return null;
}
function exportRuleToConfigData(rule: RulesExportRule): HeaderConfigData {
  const name = String(rule.name ?? "").trim();
  const headers: HeaderItem[] = [];
  if (Array.isArray(rule.headers)) {
    for (let i = 0; i < rule.headers.length; i++) {
      headers.push(normalizeHeaderItem(rule.headers[i]));
    }
  }
  return {
    name,
    scope: resolveImportScope(rule),
    headers,
    enabled: false,
  };
}

export function parseRulesImportJson(
  text: string,
): RulesExportRule[] | RulesImportError {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { key: "import.jsonInvalid" };
  }

  if (Array.isArray(json)) {
    return json.map((row) => row as unknown as RulesExportRule);
  }

  const doc = json as { rules?: unknown; configs?: unknown };
  const rules = doc.rules ?? doc.configs;
  if (Array.isArray(rules)) {
    return rules.map((row) => row as unknown as RulesExportRule);
  }

  return { key: "import.noRulesArray" };
}

export function rulesImportPreview(rules: RulesExportRule[]): {
  items: HeaderConfigData[];
  errors: RulesImportError[];
} {
  const items: HeaderConfigData[] = [];
  const errors: RulesImportError[] = [];
  if (rules.length === 0) {
    errors.push({ key: "import.fileEmpty" });
    return { items, errors };
  }

  rules.forEach((rule, index) => {
    const err = validateRule(rule, index);
    if (err) {
      errors.push(err);
    } else {
      items.push(exportRuleToConfigData(rule));
    }
  });

  return { items, errors };
}

export function summarizeRulesExport(configs: HeaderConfigData[]): {
  manual: number;
  auto: number;
} {
  let manual = 0;
  let auto = 0;
  for (const c of configs) {
    if (isManualRuleScope(c.scope)) manual++;
    else auto++;
  }
  return { manual, auto };
}
