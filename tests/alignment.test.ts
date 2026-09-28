import { expect, test } from "vitest";
import { convert } from "../packages/core/src/convert";
import { alignedLines } from "../apps/playground/src/alignment";

test("the comparison keeps every printed cell and uses source spans once per word", () => {
  const result = convert("银行发通知，《数学》里的$\u0061^2+b^2=c^2$。", {columns: 18});
  const lines = alignedLines(result);
  expect(lines.map(row => row.map(unit => unit.cells).join(""))).toEqual(result.lines);
  const units = lines.flat();
  expect(units.some(unit => unit.kind === "word" && unit.source === "银行" &&
    unit.span.start === 0 && unit.span.end === 2)).toBe(true);
  expect(units.some(unit => unit.kind === "formula" && unit.source.includes("a^2+b^2=c^2"))).toBe(true);
  expect(units.filter(unit => unit.source === "《").length).toBeLessThanOrEqual(1);
  expect(units.every(unit => unit.kind === "spacing" ||
    result.document.source.slice(unit.span.start, unit.span.end) === unit.source)).toBe(true);
});
