import { expect, test } from "vitest";
import { analyzeChineseDetailed } from "../packages/core/src/language/chinese";
import { convert } from "../packages/core/src/convert";

test("bounded geometry terms join complete ICU segments as editable proposals", () => {
  for (const text of ["边长", "计算直角三角形的边长", "正方形的边长为三厘米", "边长，周长，半径，直径"]) {
    const analysis = analyzeChineseDetailed(text);
    expect(analysis.words.some(w => w.raw === "边长" && w.source === "proposal")).toBe(true);
    expect(analysis.words.find(w => w.raw === "边长")?.syllables.map(s => s.reading)).toEqual(["bian1", "chang2"]);
    expect(analysis.words.map(w => w.raw).join("")).toBe(text);
    expect(analysis.diagnostics.some(d => d.code === "CHINESE_JOIN_PROPOSAL")).toBe(true);
  }
  const geometry = analyzeChineseDetailed("边长，周长，半径，直径").words.map(w => w.raw);
  for (const term of ["边长", "周长", "半径", "直径"]) expect(geometry).toContain(term);
});

test("technical proposals never take characters out of larger ICU words", () => {
  for (const text of ["这边长大", "一边长跑一边聊天", "这边长", "边长相等"]) {
    const baseline = [...new Intl.Segmenter("zh-CN", { granularity: "word" }).segment(text)].map(p => p.segment);
    expect(analyzeChineseDetailed(text).words.map(w => w.raw)).toEqual(baseline);
  }
});

test("technical terms preserve UTF16 offsets and manual boundaries/readings", () => {
  const text = "😀边长，𠮷边长";
  const offset = 11;
  const proposal = analyzeChineseDetailed(text, [], offset);
  expect(proposal.words.find(w => w.raw === "边长")?.span).toEqual({ start: 13, end: 15 });
  for (const word of proposal.words) {
    expect(text.slice(word.span.start - offset, word.span.end - offset)).toBe(word.raw);
    for (const syllable of word.syllables)
      expect(text.slice(syllable.span.start - offset, syllable.span.end - offset)).toBe(syllable.raw);
  }
  const split = analyzeChineseDetailed("😀边长", [
    { start: 13, end: 14, readings: ["bian1"] },
    { start: 14, end: 15, readings: ["zhang3"], retainTones: [true] },
  ], offset);
  expect(split.words.map(w => w.raw)).toEqual(["😀", "边", "长"]);
  expect(split.words.at(-1)?.syllables[0]).toMatchObject({ reading: "zhang3", source: "manual", retainTone: true });
  const partial = analyzeChineseDetailed("边长", [{start: 0, end: 1, readings: ["bian1"]}]);
  expect(partial.words.map(w => [w.raw, w.source])).toEqual([["边", "manual"], ["长", "proposal"]]);
  const joined = analyzeChineseDetailed("边长", [{start: 0, end: 2, readings: ["bian1", "zhang3"]}]);
  expect(joined.words[0]).toMatchObject({raw: "边长", source: "manual"});
  expect(joined.words[0].syllables.map(s => s.reading)).toEqual(["bian1", "zhang3"]);
});

test("technical terms cannot join across punctuation or math nodes", () => {
  for (const text of ["边，长", "边 长", "边$1+2$长"]) {
    const result = convert(text);
    expect(result.metadata.chineseWords.some(w => w.raw === "边长")).toBe(false);
  }
});
