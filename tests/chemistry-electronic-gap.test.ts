import { expect, test } from "vitest";
import { parseChemistry } from "../packages/core/src/parser/chemistry";
import { encodeChemistry } from "../packages/core/src/rules/chemistry";
import { encodeDocument } from "../packages/core/src/convert";

/**
 * GB/T 18028—2010, printed pp.65–68 (local official scans
 * `official-pages/gb18028-071.png` through `gb18028-074.png`).
 * This is a gap ledger, not a claim that the electron/Lewis clauses pass.
 *
 * §8.3.1, p65–66: n/l/m/ms, s/p/d/f, spin directions, orbital brackets and
 * single/paired electrons have distinct dot patterns. In particular the table
 * prints ↑=(1456), ↓=(3456), ()=(126,345), []=(12356,23456),
 * box-with-up=(126,1456), box-with-up/down=(1456,3456).
 * §8.3.2.1, p66: linear configurations list shell, orbital letter, and
 * right-upper electron count; H and O are the printed examples.
 * §8.3.2.2, p66: orbital diagrams may be spatial rows or a per-shell linear
 * representation; the Li and S diagrams in the standard exercise both.
 * §8.3.2.3, pp66–67: [Ne]3s²3p⁴ and [Ar]4s¹ are printed shorthand cases.
 * §8.3.2.4, p67: Lewis valence dots are POSITIONAL: left/right use dots
 * 4/5/6, above 5/6, below 4/5; the element is preceded by a letter sign.
 * Oxygen and fluorine are printed examples. A count alone cannot encode them.
 * §8.3.2.5, pp67–68: shared pairs between atoms, including H₂, N₂ and
 * methane, require topology plus orientation (some examples span rows).
 * §8.3.2.6, p68: ionic Lewis notation surrounds the anion in brackets and
 * writes charge at upper right; NaCl and NaOH are printed examples.
 *
 * Minimal future explicit representation: a typed Lewis atom with element,
 * four ordered sides each holding 0–2 individual dots, plus directed shared
 * pairs and optional bracket/charge nodes. Reject incomplete/ambiguous input
 * instead of guessing topology from a molecular formula such as O2 or CH4.
 */

const convert = (source: string) =>
  encodeChemistry(parseChemistry(source, { start: 0, end: source.length }));

// This narrow part of §8.3.2.1 is already implemented. These checks keep the
// new structural work from regressing the separately reviewed linear notation.
test.each([
  ["1s^1", "3456,1,56,234,34,2"],
  ["1s^2 2s^2 2p^4", "3456,1,56,234,34,23,3456,12,56,234,34,23,3456,12,56,1234,34,256"],
  // Printed §8.3.2.3 examples, pp.66–67. Brackets + capitalized core are
  // source-marked separately; suffix orbitals use the same §8.3.2.1 cells.
  ["[Ne]3s^2 3p^4", "12356,6,1345,15,23456,3456,14,56,234,34,23,3456,14,56,1234,34,256"],
  ["[Ar]4s^1", "12356,6,1,1235,23456,3456,145,56,234,34,2"],
])("linear electron configuration %s retains checked dots", (source, expected) => {
  const result = convert(source);
  expect(result.complete).toBe(true);
  const dots = [...result.atoms.map(atom => atom.cells).join("")].map(cell => {
    const bits = cell.charCodeAt(0) - 0x2800;
    return [1, 2, 3, 4, 5, 6].filter(dot => bits & (1 << (dot - 1))).join("");
  }).join(",");
  expect(dots).toBe(expected);
});

test("abbreviated configurations preserve core and orbital source spans", () => {
  const source = "[Ne]3s^{2} 3p^4";
  const parsed = parseChemistry(source, { start: 19, end: 19 + source.length });
  const configuration = parsed.children[0];
  expect(configuration.kind).toBe("ElectronConfiguration");
  if (configuration.kind !== "ElectronConfiguration") throw new Error("missing configuration");
  expect(configuration.core?.span).toEqual({ start: 19, end: 23 });
  expect(configuration.orbitals.map(orbital => orbital.span)).toEqual([
    { start: 23, end: 29 }, { start: 30, end: 34 },
  ]);
});

test("official shorthand runs through explicit chemistry document conversion", () => {
  const source = "[Ar]4s^1";
  const result = encodeDocument(source, { mode: "chemistry" });
  expect(result.complete).toBe(true);
  expect(result.document.source).toBe(source);
  expect(result.atoms.filter(atom => atom.kind === "cell").map(atom => atom.ruleId)).toEqual([
    "GBT18028-2010-8.3.2.3", "GBT18028-2010-8.3.2.3",
  ]);
});

test.each(["[Ne]2p^1", "[Ar]3d^1", "[Ne]3p^7", "[Xe]6s^2", "[Ne]3s^2 junk"])(
  "invalid or unsupported noble-gas shorthand %s remains unconverted",
  source => {
    const result = convert(source);
    expect(result.complete).toBe(false);
    expect(result.unhandled.length).toBeGreaterThan(0);
  },
);

// Current explicit commands deliberately retain unsupported spatial source;
// this is an honest negative test, NOT positive coverage for §§8.3.2.2–6.
test.each(["\\orbital{↑↓}", "\\lewis{O}", "\\lewis{NaCl}"])(
  "spatial electron input %s is retained until a verified encoder exists",
  source => {
    const result = convert(source);
    expect(result.complete).toBe(false);
    expect(result.unhandled.some(item => item.raw === source)).toBe(true);
    expect(result.diagnostics.some(item => item.code === "chemistry-unsupported-structure")).toBe(true);
  },
);

// These source examples need a typed spatial input grammar and independent
// dot-by-dot transcription from the printed braille before becoming assertions.
test.todo("§8.3.2.2 p66: Li one-row and per-shell orbital encodings match the printed alternatives");
test.todo("§8.3.2.4 p67: positional O and F Lewis dots match all three printed rows");
test.todo("§8.3.2.5 pp67–68: H₂, N₂, methane and acetic acid preserve shared-pair topology");
test.todo("§8.3.2.6 p68: NaCl and NaOH anion brackets and upper-right charge match printed examples");
