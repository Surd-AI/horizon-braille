import { describe, expect, it, vi } from "vitest";
import { collectAmbiguities, convertWithResolutions, resolveAmbiguities, type Ambiguity } from "../packages/core/src/ambiguity";

describe("bounded local lexical and prose decisions", () => {
  it("completes the bank notice offline with source-aligned readings", async () => {
    const source = "银行发通知：会议12:30开始，比例3:2。";
    const result = convertWithResolutions(source, await resolveAmbiguities(source));
    expect(result.complete).toBe(true);
    expect(result.document.source).toBe(source);
    const readings = result.metadata.chineseWords.flatMap(w => w.syllables);
    for (const [at, reading] of [[1, "hang2"], [2, "fa1"], [4, "zhi1"], [6, "hui4"]] as const)
      expect(readings.find(s => s.span.start === at)?.reading).toBe(reading);
    const unavailable = vi.fn(async () => { throw new Error("offline"); });
    expect(convertWithResolutions(source, await resolveAmbiguities(source, { provider: unavailable })).complete).toBe(true);
    expect(unavailable).not.toHaveBeenCalled();
  });
  it("does not extend the dispatch reading into hair or arbitrary phrases", async () => {
    for (const source of ["发", "头发通知", "理发通知", "毛发通知", "发$通知$", "$发通知$", "发，通知"]) {
      const result = await resolveAmbiguities(source);
      const ids = result.ambiguities.filter(a => a.contextTarget?.text === "发").map(a => a.id);
      expect(result.resolutions.filter(r => ids.includes(r.id))).toEqual([]);
    }
  });
  it("keeps a manual dispatch reading and emits only one pending per unresolved span", async () => {
    const source = "发通知", a = collectAmbiguities(source).find(a => a.span.start === 0)!;
    const set = await resolveAmbiguities(source, { manual: { documentSource: source, resolutions: [{ id: a.id, choice: "fa4", source: "manual" }] } });
    expect(set.resolutions.find(r => r.id === a.id)).toMatchObject({ choice: "fa4", source: "manual" });
    const unresolved = convertWithResolutions("发", await resolveAmbiguities("发"));
    expect(unresolved.diagnostics.filter(d => d.code === "ambiguity-pending")).toHaveLength(1);
  });
  it("resolves bank notice readings and the prose colon before clock context", async () => {
    const source = "银行发通知：会议12:30开始，比例3:2。";
    const result = await resolveAmbiguities(source);
    for (const [at, choice] of [[1, "hang2"], [4, "zhi1"], [5, "punctuation"]] as const) {
      const a = result.ambiguities.find(a => a.span.start === at)!;
      expect(result.resolutions.find(r => r.id === a.id)).toMatchObject({ choice, source: "heuristic" });
    }
  });
  it("does not send fixed words to a conflicting model", async () => {
    const provider = vi.fn(async (questions: readonly Ambiguity[]) => ({ diagnostics: [], resolutions: questions.map(a => ({ id: a.id, choice: a.candidates[0].id, source: "api" as const, confidence: 0.99 })) }));
    const result = await resolveAmbiguities("银行通知", { provider });
    expect(provider).not.toHaveBeenCalled();
    expect(result.resolutions.map(r => r.choice)).toEqual(["hang2", "tong1", "zhi1"]);
  });
  it("keeps manual decisions ahead of the local lexicon", async () => {
    const source = "银行通知", a = collectAmbiguities(source).find(a => a.span.start === 1)!;
    const result = await resolveAmbiguities(source, { manual: { documentSource: source, resolutions: [{ id: a.id, choice: "xing2", source: "manual" }] } });
    expect(result.resolutions.find(r => r.id === a.id)).toMatchObject({ choice: "xing2", source: "manual" });
  });
  it("does not infer readings from arbitrary or partial words", async () => {
    for (const source of ["行", "知", "银，行", "银$ x $行"]) {
      const result = await resolveAmbiguities(source);
      expect(result.resolutions.filter(r => r.choice !== "unknown")).toEqual([]);
    }
  });
  it("does not treat mathematical or unrecognized labels as prose notices", async () => {
    for (const source of ["f：A", "x:y", "通知：3:2", "$通知：会议$"]) {
      const result = await resolveAmbiguities(source);
      expect(result.resolutions.some(r => r.choice === "punctuation")).toBe(false);
    }
  });
  it("preserves manual pronunciation overrides", async () => {
    const result = await resolveAmbiguities("银行", { overrides: [{ start: 0, end: 2, readings: ["yin2", "xing2"] }] });
    expect(result.ambiguities).toEqual([]);
  });
  it("requires the complete segmented word rather than a source substring", async () => {
    const result = await resolveAmbiguities("银行", { wordBoundaries: [{ start: 0, end: 1 }, { start: 1, end: 2 }] });
    expect(result.resolutions).toEqual([]);
  });
  it("retains human review below 0.5", async () => {
    const result = await resolveAmbiguities("行", { provider: async questions => ({ diagnostics: [], resolutions: questions.map(a => ({ id: a.id, choice: "xing2", source: "api", confidence: 0.49 })) }) });
    expect(result.resolutions).toEqual([]);
    expect(result.diagnostics.filter(d => d.code === "ambiguity-pending")).toHaveLength(1);
  });
  it("handles UTF-16 offsets and standalone dictionary words", async () => {
    for (const source of ["银行", "通知", "会议", "发通知", "😀银行通知"]) {
      const result = await resolveAmbiguities(source);
      expect(result.diagnostics.some(d => d.code === "ambiguity-pending")).toBe(false);
      expect(result.resolutions.every(r => r.source === "heuristic")).toBe(true);
    }
  });
});
