import { describe, expect, it } from "vitest";
import { Config } from "@/shared/models/Config";
import { ConfigService, RESOURCE_TYPES } from "@/shared/services/ConfigService";

describe("ConfigService scope matching", () => {
  const svc = new ConfigService();

  it("match-all scopes", () => {
    expect(svc.isMatchAllScope({ type: "all", value: "" })).toBe(true);
    expect(svc.isMatchAllScope({ type: "regex", value: "*" })).toBe(true);
    expect(svc.isMatchAllScope({ type: "regex", value: "" })).toBe(true);
    expect(svc.isMatchAllScope({ type: "regex", value: "http://localhost" })).toBe(false);
  });

  it("prefix matches SPA tab URL with slash before hash", () => {
    const tabUrl =
      "http://localhost:8080/e-static/iov/default/#/iov_dev/iovSimCardManager/iovSimCardInfo";
    const scope = { type: "regex" as const, value: "http://localhost:8080/e-static/iov/default/" };
    expect(svc.isUrlMatchingScope(tabUrl, scope)).toBe(true);
  });

  it("prefix matches SPA tab URL without slash before hash", () => {
    const tabUrl =
      "http://localhost:8080/e-static/iov/default#/iov_dev/iovSimCardManager/iovSimCardInfo";
    const scope = { type: "regex" as const, value: "http://localhost:8080/e-static/iov/default/" };
    expect(svc.isUrlMatchingScope(tabUrl, scope)).toBe(true);
  });
});

describe("ConfigService buildDnrRules", () => {
  it("match-all rules have no tabIds", () => {
    const svc = new ConfigService();
    const cfg = new Config({
      name: "Default",
      enabled: true,
      scope: { type: "all", value: "" },
      headers: [{ name: "Authorization", value: "Bearer 123", type: "request", enabled: true }],
    });

    const rules = svc.buildDnrRules([cfg]);
    expect(rules).toHaveLength(1);
    expect(rules[0].condition?.tabIds).toBeUndefined();
    expect(rules[0].action?.requestHeaders?.[0]?.header).toBe("Authorization");
  });

  it("session rules include tabIds", () => {
    const svc = new ConfigService();
    const cfg = new Config({
      enabled: true,
      scope: { type: "regex", value: "http://example.com" },
      headers: [{ name: "X-Test", value: "1", type: "request", enabled: true }],
    });
    const rules = svc.buildDnrRules([cfg], [42]);
    expect(rules[0].condition?.tabIds).toEqual([42]);
  });

  it("getEnabledConfigs includes enabled rules with headers and skips disabled ones", async () => {
    const svc = new ConfigService();
    const manualA = new Config({
      id: "manual_a",
      enabled: true,
      scope: { type: "all", value: "" },
      headers: [{ name: "X", value: "1", type: "request", enabled: true }],
    });
    const manualB = new Config({
      id: "manual_b",
      enabled: false,
      scope: { type: "all", value: "" },
      headers: [{ name: "Y", value: "2", type: "request", enabled: true }],
    });
    (svc as unknown as { configs: Config[] }).configs = [manualA, manualB];

    const entries = await svc.getEnabledConfigs({ tabs: [] });
    expect(entries).toHaveLength(1);
    expect(entries[0].config.id).toBe("manual_a");
  });

  it("RESOURCE_TYPES covers xhr and main_frame", () => {
    expect(RESOURCE_TYPES).toContain("xmlhttprequest");
    expect(RESOURCE_TYPES).toContain("main_frame");
  });
});
