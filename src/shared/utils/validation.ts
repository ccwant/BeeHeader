import { HeaderItem } from "@/types";

/** validation.* 与 import.* 共用的错误 key */
export type ValidationMessageKey =
  | "validation.aliasEmpty"
  | "validation.aliasTooShort"
  | "validation.headerInvalid"
  | "validation.headerNameEmpty"
  | "validation.headerNameInvalid"
  | "validation.headerValueRequired"
  | "validation.headerValueControl"
  | "validation.headerValueTooLong";

export class ValidationUtils {
  /** Chrome DNR modifyHeaders 接受的请求头名字符集 */
  static readonly HEADER_NAME_RE = /^[a-zA-Z0-9!#$&'*+.^_`|~-]+$/;

  /**
   * 规则别名校验；通过返回 null，否则返回 i18n key。
   */
  static validateRuleAlias(alias: string): ValidationMessageKey | null {
    const t = alias.trim();
    if (!t) return "validation.aliasEmpty";
    if (t.length <= 2) return "validation.aliasTooShort";
    return null;
  }

  /**
   * 判断头名是否可被 DNR 接受。
   */
  static isValidHeaderName(name: string): boolean {
    const t = (name ?? "").trim();
    return !!t && ValidationUtils.HEADER_NAME_RE.test(t);
  }

  /**
   * 导入/编辑时校验头名；失败返回 i18n key。
   */
  static validateHeaderName(name: string): ValidationMessageKey | null {
    const t = (name ?? "").trim();
    if (!t) return "validation.headerNameEmpty";
    if (!ValidationUtils.HEADER_NAME_RE.test(t)) {
      return "validation.headerNameInvalid";
    }
    return null;
  }

  /**
   * 校验单行 header；未启用的空行不阻断导入。
   */
  static validateHeaderItem(item: HeaderItem): ValidationMessageKey | null {
    if (Array.isArray(item) && item.length >= 2) {
      return ValidationUtils.validateHeaderName(String(item[0] ?? ""));
    }
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return "validation.headerInvalid";
    }
    if (item.enabled === false) return null;
    return ValidationUtils.validateHeaderName(String(item.name ?? ""));
  }

  /**
   * Header value 校验；返回 i18n key 列表。
   */
  static validateHeaderValue(value: unknown): ValidationMessageKey[] {
    const errors: ValidationMessageKey[] = [];
    if (value === null || value === undefined) {
      errors.push("validation.headerValueRequired");
      return errors;
    }
    const stringValue = String(value);
    const controlCharRegex = /[\x00-\x1F\x7F]/;
    if (controlCharRegex.test(stringValue)) {
      errors.push("validation.headerValueControl");
    }
    if (stringValue.length > 8192) {
      errors.push("validation.headerValueTooLong");
    }
    return errors;
  }
}