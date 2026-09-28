import { expect, test } from "vitest";
import { parseChemistry } from "../packages/core/src/parser/chemistry";
import { encodeChemistry } from "../packages/core/src/rules/chemistry";

const convert = (source: string) => encodeChemistry(parseChemistry(source));
const dotPositions = (source: string) =>
  Array.from(convert(source).atoms.map((atom) => atom.cells).join(""), (cell) => {
    const bits = cell.charCodeAt(0) - 0x2800;
    return bits === 0
      ? "SP"
      : [1, 2, 3, 4, 5, 6]
          .filter((position) => bits & (1 << (position - 1)))
          .join("");
  }).join(",");

// GB/T 18028-2010, printed pp. 68–69 (§8.4.1 and §8.4.2.1).
// The two horizontal examples on p.69 are independently checked against the
// printed dot patterns. No claim about the remaining spatial bonds follows.
test.each([
  ["H-O-H", "6,125,36,6,135,36,6,125"],
  ["N#N", "6,1345,123456,6,1345"],
])("horizontal structure %s has no inserted empty cell", (source, expected) => {
  expect(convert(source).complete).toBe(true);
  expect(dotPositions(source)).toBe(expected);
  expect(dotPositions(source)).not.toContain("SP");
});

// The parser may accept linearized chemistry, but must never reinterpret a
// spatial bond glyph as an ordinary horizontal bond by guessing its geometry.
test.each([
  ["H/C", "diagonal bond (§8.4.1 items 3–6, p.68)"],
  ["H|C", "vertical bond (§8.4.1 item 2, p.68)"],
  ["\\chemgraph{benzene}", "ring graph (§8.4.2.5, pp.70–71)"],
])("unsupported structure %s remains incomplete: %s", (source) => {
  const result = convert(source);
  expect(result.complete).toBe(false);
  expect(result.unhandled.length).toBeGreaterThan(0);
});

// Source-grounded worklist: intentionally pending, rather than asserting a
// false implementation or silently marking an entire clause as verified.
test.todo("§8.4.1 pp.68–69: vertical and all diagonal single/double/triple bonds, star and position mark encode exactly");
test.todo("§8.4.2.2 p.69: 2D methane, acetone and vertical N≡N retain row/column topology");
test.todo("§8.4.2.3 pp.69–70: branching and isomer structures preserve group connectivity and elongated bonds");
test.todo("§8.4.2.4 p.70: condensed formulas preserve every functional group and have checked space policy");
test.todo("§8.4.2.5 pp.70–72: rings, aromatics and fused rings preserve closure, diagonal direction and π-bond notation");
test.todo("§8.4.2.6 p.72: active-atom star follows its atom with no intervening empty cell");
test.todo("§8.4.2.7 p.72: hydrogen-bond dots preserve non-covalent linkage and spacing");
test.todo("§8.4.2.8 pp.72–73: polymer repeat unit, chain count and substitution branches encode exactly");
test.todo("§8.4.2.9 pp.73–74: coordinate-based linearization of 2D structural formulas round-trips topology");
