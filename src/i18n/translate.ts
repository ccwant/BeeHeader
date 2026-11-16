/**
 * 将 i18n key 或后台原文转为当前语言；未知 key 原样返回。
 */
export function translateMessage(
  i18n: { global: { t: (key: string) => string; te: (key: string) => boolean } },
  text: string,
): string {
  const { t, te } = i18n.global;
  if (te(text)) return t(text);
  return text;
}