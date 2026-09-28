import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");
const rules = JSON.parse(read("standards/registry.json")) as { status: string; standard: string }[];
const totals = Object.fromEntries(
  ["verified", "implemented-unverified", "uncovered"].map((status) => [
    status,
    rules.filter((rule) => rule.status === status).length,
  ]),
);

describe("public coverage statements", () => {
  it("describes supported inputs and review signals without implying full certification", () => {
    const zh = read("README.md");
    const en = read("README.en.md");
    for (const text of [zh, en]) {
      expect(text).toContain("Unicode");
      expect(text).toContain("complete");
      expect(text).toContain("docs/standard-coverage.md");
    }
    expect(zh).toContain("软件输出不等于官方标准认证");
    expect(en).toContain("not official standards certification");
  });

  it("keeps the detailed table and incomplete inventory claim aligned", () => {
    const docs = read("docs/standard-coverage.md");
    const coverage = JSON.parse(read("standards/coverage.json")) as {
      fullStandardSupport: boolean;
      inventoryComplete: boolean;
    };
    const count = (standard: string, status: string) =>
      rules.filter((rule) => rule.standard === standard && rule.status === status).length;
    for (const standard of ["GF0019-2018", "GB/T18028-2010", "GB/T44725-2024"])
      expect(docs).toContain(`| ${standard} | ${count(standard, "verified")} | ${count(standard, "implemented-unverified")} | ${count(standard, "uncovered")} |`);
    expect(docs).toContain(`| Total | ${totals.verified} | ${totals["implemented-unverified"]} | ${totals.uncovered} |`);
    expect(coverage).toMatchObject({ fullStandardSupport: false, inventoryComplete: false });
    expect(docs).toContain("inventoryComplete:false");
  });
});
