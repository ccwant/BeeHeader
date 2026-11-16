import type { RulesImportError } from "@/shared/utils/rules";
import type { ComposerTranslation } from "vue-i18n";

/**
 * 将 rules 导入校验错误格式化为当前语言的单行文案。
 */
export function formatRulesImportError(err: RulesImportError, t: ComposerTranslation): string {
  if (err.key === "import.ruleLine") {
    return t(err.key, {
      index: err.params.index,
      reason: t(err.params.reason),
    });
  }
  return t(err.key);
}