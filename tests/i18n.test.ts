import { describe, expect, it } from "vitest";
import { createBeeI18n } from "@/i18n";

describe("createBeeI18n", () => {
  it("translates static keys", () => {
    const i18n = createBeeI18n("zh-CN");
    expect(i18n.global.t("headerBar.pause")).toBe("暂停");
  });

  it("translates interpolated keys", () => {
    const i18n = createBeeI18n("zh-CN");
    expect(i18n.global.t("rulesDialog.defaultRuleName", { n: 2 })).toBe("新规则2");
  });
});