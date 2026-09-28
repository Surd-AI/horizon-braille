import { expect, test } from "vitest";
import { parseChemistry } from "../packages/core/src/parser/chemistry";
import { encodeChemistry } from "../packages/core/src/rules/chemistry";

const convert = (source: string) => encodeChemistry(parseChemistry(source));
const dots = (source: string) => [...convert(source).atoms.map(a => a.cells).join("")].map(cell => {
  const bits = cell.charCodeAt(0) - 0x2800;
  return bits ? [1, 2, 3, 4, 5, 6].filter(dot => bits & (1 << (dot - 1))).join("") : "SP";
}).join(",");

// GB/T 18028-2010, printed pp. 61–62, §§8.2.2.1 and 8.2.2.4.
// The printed O₂ and Cl₂ examples use lowered atom counts with neither an
// index-direction indicator nor a numeric indicator.
test.each([
  ["O2", "6,135,23"],
  ["Cl2", "6,14,123,23"],
  ["O_2", "6,135,23"],
])("pure molecular formula %s has an unmarked lowered count", (source, expected) => {
  const result = convert(source);
  expect(result.complete).toBe(true);
  expect(dots(source)).toBe(expected);
  expect(result.atoms.at(-1)?.ruleId).toBe("GBT18028-2010-8.2.2.1");
});

test("a compound's count remains governed by the compound-index rule", () => {
  const result = convert("H2O");
  expect(result.complete).toBe(true);
  expect(result.atoms.find(atom => atom.span.start === 1)?.ruleId).toBe("GBT18028-2010-8.2.2.4");
});

test.each(["O0", "O02", "O_0", "O_02", "Cl02"])("rejects invalid atom count %s", source => {
  const result = convert(source);
  expect(result.complete).toBe(false);
  expect(result.unhandled.some(part => part.raw.includes("0"))).toBe(true);
  expect(result.diagnostics.some(diagnostic => diagnostic.message.includes("Atom count"))).toBe(true);
});

// GB/T 18028-2010, printed p. 60, §8.1.2.5 lists left atomic number,
// left mass number, element, right atom count, then right ionic charge.
test("isotope, atom count and ionic charge retain the prescribed source order", () => {
  const source = "{}_{7}^{14}N_2^{+}";
  const ast = parseChemistry(source);
  expect(ast.children.map(part => part.kind)).toEqual(["Isotope", "Element", "Count", "Charge"]);
  expect(convert(source).complete).toBe(true);
  const invalid = convert("{}_{7}^{14}N^{+}_2");
  expect(invalid.complete).toBe(false);
  expect(invalid.unhandled.length).toBeGreaterThan(0);
});
