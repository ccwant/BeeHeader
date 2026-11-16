import { HeaderItem } from "@/types";

export class ValidationUtils {
  // —— 别名 ——
  /** 规则别名：必填，长度须大于 2 个字符 */
  static validateRuleAlias(alias: string): string | null {
    const t = alias.trim();
    if (!t) return "请填写别名";
    if (t.length < 2) return "别名须超过 2 个字符";
    return null;
  }

  static validateHeaderItem(item: HeaderItem): string | null {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return "Header item is invalid";
    }
    const name = String(item.name ?? "").trim();
    if (!name) return "Header name is required";
    return null;
  }

  static validateHeaderValue(value: unknown): string[] {
    const errors: string[] = [];

    if (value === null || value === undefined) {
      errors.push("Header value is required");
      return errors;
    }

    const stringValue = String(value);
    const controlCharRegex = /[\x00-\x1F\x7F]/;
    if (controlCharRegex.test(stringValue)) {
      errors.push("Header value cannot contain control characters");
    }

    if (stringValue.length > 8192) {
      errors.push("Header value must be <= 8192 chars");
    }

    return errors;
  }
}
