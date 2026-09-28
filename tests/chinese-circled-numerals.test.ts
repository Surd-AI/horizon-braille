import { expect, test } from "vitest";
import { convert } from "../packages/core/src/convert";
import { encodeText } from "../packages/core/src/rules/text";
import { braille } from "../packages/core/src/rules/math-symbols";

test("GF0019 informative Annex B keeps circled numbers in lowered position", () => {
  const cases: [string, string[]][] = [
    ["①", ["3456", "2"]],
    ["③", ["3456", "25"]],
    ["⑩", ["3456", "2", "356"]],
  ];
  for (const [source, dots] of cases) {
    const encoded = encodeText(source);
    expect(encoded.complete).toBe(true);
    expect(encoded.unhandled).toEqual([]);
    expect(encoded.atoms.map(atom => atom.cells).join("")).toBe(braille(dots));
    expect(encoded.atoms[0].ruleId).toBe("GF0019-2018-B");
    expect(encoded.atoms[0].span).toEqual({ start: 0, end: 1 });
    expect(convert(source, { paragraphIndent: 0 }).unicode).toBe(braille(dots));
  }
});

test("circled numeral and ordinary numeral retain different encodings", () => {
  expect(encodeText("①").atoms[0].cells).toBe(braille(["3456", "2"]));
  expect(encodeText("1").atoms[0].cells).toBe(braille(["3456", "1"]));
  // The Annex shows only one-digit encircled examples; never silently turn
  // unsupported Unicode forms into plain numerals.
  const outsideAnnex = encodeText("⑪");
  expect(outsideAnnex.complete).toBe(false);
  expect(outsideAnnex.unhandled.map(item => item.raw)).toContain("⑪");
});
