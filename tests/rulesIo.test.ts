import { describe, expect, it } from "vitest";
import {
  buildRulesExportDocument,
  parseRulesImportJson,
  rulesImportPreview,
  RULES_EXPORT_KIND,
} from "@/shared/utils/rules";

describe("rules import/export", () => {
  it("round-trips export document", () => {
    const doc = buildRulesExportDocument([
      {
        id: "1",
        name: "API",
        scope: { type: "regex", value: "http://example.com" },
        headers: [{ name: "X", value: "1", type: "request", enabled: true }],
      },
    ]);
    expect(doc.kind).toBe(RULES_EXPORT_KIND);
    const text = JSON.stringify(doc);
    const rules = parseRulesImportJson(text);
    expect(Array.isArray(rules)).toBe(true);
    const { items, errors } = rulesImportPreview(rules as never);
    expect(errors).toHaveLength(0);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("API");
    expect(items[0].scope?.value).toBe("http://example.com");
  });

  it("rejects invalid alias", () => {
    const { errors } = rulesImportPreview([{ name: "ab" }]);
    expect(errors.length).toBeGreaterThan(0);
  });
});
