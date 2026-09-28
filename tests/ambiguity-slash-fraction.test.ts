import { expect, test } from "vitest";
import { collectAmbiguities, convertWithResolutions, resolveAmbiguities } from "../packages/core/src/ambiguity";
import { encodeDocument } from "../packages/core/src/convert";
import { parseMath } from "../packages/core/src/parser/math";
import { encodeMath } from "../packages/core/src/rules/math";

const cellsIn = (source: string, start: number, end: number) =>
  encodeMath(parseMath(source.slice(start, end), { start, end })).atoms.map(a => a.cells).join("");

test("an explicit prose fraction uses the checked mathematical slash without extra blanks", async () => {
  const source = "分数3/2", span = { start: 2, end: 5 };
  const decision = await resolveAmbiguities(source);
  expect(decision.resolutions).toContainEqual(expect.objectContaining({ choice: "fraction", source: "heuristic" }));
  const result = convertWithResolutions(source, decision);
  expect(result.document.source).toBe(source);
  expect(result.atoms.flatMap(a => a.kind === "cell" && a.span.start >= span.start && a.span.end <= span.end ? [a.cells] : []).join(""))
    .toBe(cellsIn(source, span.start, span.end));
  expect(result.atoms.some(a => a.ruleId === "GBT18028-2010-6.4" && a.span.start === 3)).toBe(true);
  expect(result.diagnostics.some(d => d.code === "bare-ambiguous-formula" && d.span.start === span.start)).toBe(false);
});

test("an unlabelled numeric slash needs a source-bound decision", async () => {
  const source = "3/2", question = collectAmbiguities(source).find(a => a.kind === "slash")!;
  expect(question).toMatchObject({ span: { start: 1, end: 2 }, tokenSpan: { start: 0, end: 3 } });
  const initial = await resolveAmbiguities(source);
  expect(initial.resolutions.find(r => r.id === question.id)).toBeUndefined();
  const manual = await resolveAmbiguities(source, { manual: {
    documentSource: source, resolutions: [{ id: question.id, choice: "fraction", source: "manual" }],
  } });
  const converted = convertWithResolutions(source, manual);
  expect(converted.atoms.filter(a => a.kind === "cell").map(a => a.cells).join("")).toBe(cellsIn(source, 0, 3));
  expect(converted.complete).toBe(true);
  const stale = convertWithResolutions(source, { ...manual, documentSource: "1/2" });
  expect(stale.atoms).toEqual(encodeDocument(source).atoms);
});

test.each(["日期2026/09/27", "路径/home/user", "1/2+3", "a/2", "3/2/4", "$3/2$"])(
  "does not infer a standalone prose fraction in %s", source => {
    expect(collectAmbiguities(source).some(a => a.kind === "slash")).toBe(false);
  },
);
