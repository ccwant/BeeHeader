import { describe, expect, it } from "vitest";
import { pickEditingConfigId } from "@/shared/utils/rules";
import type { HeaderConfigData } from "@/types";

const manual = {
  id: "m1",
  scope: { type: "all" as const, value: "" },
};
const auto = {
  id: "a1",
  scope: { type: "regex" as const, value: "https://example.com" },
};

describe("pickEditingConfigId", () => {
  it("keeps a still-valid active id", () => {
    const configs = [manual, auto] as HeaderConfigData[];
    expect(
      pickEditingConfigId({
        configs,
        activeId: "a1",
        manualActiveId: "m1",
        tabUrl: "https://other.test",
      }),
    ).toBe("a1");
  });

  it("falls back to the auto rule matching the tab", () => {
    const configs = [manual, auto] as HeaderConfigData[];
    expect(
      pickEditingConfigId({
        configs,
        activeId: "gone",
        manualActiveId: "m1",
        tabUrl: "https://example.com/path",
      }),
    ).toBe("a1");
  });
});