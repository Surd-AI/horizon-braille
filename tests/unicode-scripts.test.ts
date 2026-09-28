import { expect, test } from "vitest";
import { encodeDocument } from "../packages/core/src/convert";

const cells = (source: string, mode: "document" | "math" = "document") => {
  const result = encodeDocument(source, { mode });
  return {
    complete: result.complete,
    braille: result.atoms.filter(atom => atom.kind === "cell").map(atom => atom.cells).join(""),
    diagnostics: result.diagnostics,
    document: result.document,
  };
};

test.each([
  ["a²+b²=c²", "a^2+b^2=c^2"],
  ["x₁²+x₂³", "x_1^2+x_2^3"],
  ["(x²+1)=2", "(x^2+1)=2"],
  ["x¹²", "x^{12}"],
  ["10⁻³", "10^{-3}"],
  ["x⁺²", "x^{+2}"],
])("Unicode math scripts %s match explicit TeX %s", (unicode, tex) => {
  const actual = cells(unicode);
  const expected = cells(tex);
  expect(actual.complete).toBe(true);
  expect(expected.complete).toBe(true);
  expect(actual.braille).toBe(expected.braille);
  expect(actual.document.source).toBe(unicode);
});

test("a pasted Unicode operator without its right operand is diagnosed", () => {
  const result = cells("2×");
  expect(result.complete).toBe(false);
  expect(result.diagnostics.length).toBeGreaterThan(0);
});

test("Unicode scripts work inside explicit math mixed with Chinese", () => {
  const source = "勾股定理：$a²+b²=c²$。";
  const result = cells(source);
  expect(result.document.source).toBe(source);
  expect(result.diagnostics.some(d => d.code === "math-unknown")).toBe(false);
  expect(result.braille).toContain(cells("a^2+b^2=c^2", "math").braille);
});

test.each([
  ["α+β", "\\alpha+\\beta"],
])("bare Unicode Greek math %s matches TeX %s", (unicode, tex) => {
  const actual = cells(unicode);
  const expected = cells(tex);
  expect(actual.complete).toBe(true);
  expect(actual.braille).toBe(expected.braille);
});

test("adjacent Unicode Greek, Latin and superscript stay in one math island", () => {
  const result = cells("πr²");
  expect(result.complete).toBe(true);
  expect(result.document.source).toBe("πr²");
  expect(result.braille).toContain("⠨⠏⠰⠗⠌⠆");
});

test.each([
  ["2×3", "2\\times 3"],
  ["6÷2", "6\\div 2"],
  ["x≤5", "x\\leq 5"],
  ["α×β", "\\alpha\\times\\beta"],
])("Unicode infix %s matches TeX %s", (unicode, tex) => {
  const actual = cells(unicode);
  const expected = cells(tex);
  expect(actual.complete).toBe(true);
  expect(expected.complete).toBe(true);
  expect(actual.braille).toBe(expected.braille);
});

test("unsupported presentation signs are diagnosed instead of guessed", () => {
  const result = cells("x⁻", "math");
  expect(result.complete).toBe(false);
  expect(result.diagnostics.length).toBeGreaterThan(0);
});
