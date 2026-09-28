import { expect, test } from "vitest";
import { parseChemistry } from "../packages/core/src/parser/chemistry";
import { encodeChemistry } from "../packages/core/src/rules/chemistry";
import { encodeDocument } from "../packages/core/src/convert";
const convert = (raw: string, start = 0) => encodeChemistry(parseChemistry(raw, { start, end: start + raw.length }));
const dots = (raw: string) => [...convert(raw).atoms.map(a => a.cells).join("")].map(c => {
  const bits = c.charCodeAt(0) - 0x2800;
  return bits ? [1,2,3,4,5,6].filter(d => bits & (1 << (d - 1))).join("") : "SP";
}).join(",");

// P: independently read printed examples, GB/T18028 p62 / §8.2.2.4–5.
// D: compositions of those checked rules; input commands are our explicit syntax.
test.each([
  ["C_nH_{2n+2}", "456,14,16,56,1345,156,125,16,3456,12,56,1345,235,3456,12,156"],
  ["C_nH_{2n-2}", "456,14,16,56,1345,156,125,16,3456,12,56,1345,36,3456,12,156"],
  ["C_{n+1}H_{2n+2}", "456,14,16,56,1345,235,3456,1,156,125,16,3456,12,56,1345,235,3456,12,156"],
  ["S\\oxidationabove{+4}O\\oxidationabove{-2}2", "456,234,46,34,256,135,46,34,36,23,156,23"],
  ["Fe\\oxidation{+3}", "6,124,15,34,25"],
  ["Fe^{3+}", "6,124,15,46,3456,14,6,235"],
  // P fragments p66 §8.3.2.1: omit the element label/two spaces preceding configuration.
  ["1s^1", "3456,1,56,234,34,2"],
  ["1s^2 2s^2 2p^4", "3456,1,56,234,34,23,3456,12,56,234,34,23,3456,12,56,1234,34,256"],
  // D neon configuration follows the same population rule.
  ["1s^2 2s^2 2p^6", "3456,1,56,234,34,23,3456,12,56,234,34,23,3456,12,56,1234,34,235"],
])("checked extended chemistry %s", (raw, expected) => {
  expect(convert(raw).complete).toBe(true);
  expect(dots(raw)).toBe(expected);
});

test("oxidation and charge have different explicit AST semantics", () => {
  expect(parseChemistry("Fe\\oxidation{+3}").children.map(n => n.kind)).toEqual(["Element", "Oxidation"]);
  expect(parseChemistry("Fe^{3+}").children.map(n => n.kind)).toEqual(["Element", "Charge"]);
  expect(convert("Fe^{+3}").complete).toBe(false);
});
test("oxidation aliases and following counts preserve the terminator", () => {
  expect(dots("Fe\\ox{+3}")).toBe(dots("Fe\\oxidation{+3}"));
  expect(dots("Fe\\oxabove{-2}2")).toBe("6,124,15,46,34,36,23,156,23");
});
test("configuration AST retains each complete orbital source range", () => {
  const raw = "1s^{2} 2s^2 2p^6";
  const n = parseChemistry(raw, { start: 9, end: 9 + raw.length }).children[0];
  expect(n.kind).toBe("ElectronConfiguration");
  if (n.kind !== "ElectronConfiguration") throw new Error("missing configuration");
  expect(n.orbitals.map(o => raw.slice(o.span.start - 9, o.span.end - 9))).toEqual(["1s^{2}", "2s^2", "2p^6"]);
  expect(n.orbitals.map(o => [o.shell, o.orbital, o.population])).toEqual([["1", "s", "2"], ["2", "s", "2"], ["2", "p", "6"]]);
});
test("extended inputs retain resource limits", () => {
  for (const raw of ["C_{2n+2}", "Fe\\oxidation{+3}", "1s^2 2s^2"]) {
    const result = encodeChemistry(parseChemistry(raw, undefined, { maxLength: 3 }));
    expect(result.complete).toBe(false);
    expect(result.unhandled[0].raw).toBe(raw);
    expect(result.diagnostics.some(d => d.code === "chemistry-resource-limit")).toBe(true);
  }
});
test.each(["C_{n+1}H_{2n+2}", "Fe\\oxidation{+3}", "1s^2 2s^2 2p^6"])("integrates through explicit chemistry conversion %s", raw => {
  const result = encodeDocument(raw, { mode: "chemistry" });
  expect(result.complete).toBe(true);
  expect(result.document.source).toBe(raw);
  expect(result.atoms.map(a => a.kind === "cell" ? a.cells : "").join("")).toBe(convert(raw).atoms.map(a => a.cells).join(""));
});
test.each([
  "C_{n*m}", "C_{n+m}", "C_{n^2}", "C_{2n+}", "C_{0n}",
  "\\oxidation{+3}Fe", "Fe\\oxidation{3+}", "Fe\\oxidation{III}", "Fe\\oxidation{+3", "Fe2\\oxidation{+3}",
  "1s^3", "1p^2", "2d^2", "2p^7", "0s^2", "1s^2 1s^1", "1s^2 junk", "1s^{2", "\\orbital{↑↓}", "\\lewis{O}",
])("retains unsupported/invalid source %s", raw => {
  const result = convert(raw);
  expect(result.complete).toBe(false);
  expect(result.unhandled.length).toBeGreaterThan(0);
});
test.each(["\\ce{C_{n+1}H_{2n+2}}", "\\ce{Fe\\oxidation{-2}_2}", "\\ce{1s^{2} 2s^2 2p^6}"])("keeps absolute source mappings %s", raw => {
  const ast = parseChemistry(raw, { start: 17, end: 17 + raw.length });
  expect(ast.raw).toBe(raw);
  const result = encodeChemistry(ast);
  expect(result.complete).toBe(true);
  for (const a of result.atoms) {
    expect(a.span.start).toBeGreaterThanOrEqual(21);
    expect(a.span.end).toBeLessThanOrEqual(16 + raw.length);
    expect(a.span.end).toBeGreaterThan(a.span.start);
  }
  for (const n of ast.children) expect(raw.slice(n.span.start - 17, n.span.end - 17)).toBe(n.raw);
});

// GB/T 18028–2010 printed p64 §8.2.2.10 (linear decomposition), with
// symbols 37/38 defined on printed p61 §8.2.1. The formulae below are
// derived compositions of those directly printed symbol rules; they are not
// transcriptions of the standard's full planar example.
test.each([
  ["H2CO3\\decompabove{H2O+CO2↑}", "34,45,25,135"],
  ["H2CO3\\decompbelow{H2O+CO2↑}", "34,56,25,135"],
])("linear decomposition keeps arrow position and endpoint %s", (raw, arrow) => {
  const ast = parseChemistry(raw, { start: 17, end: 17 + raw.length });
  const result = encodeChemistry(ast);
  expect(result.complete).toBe(true);
  expect(ast.children.at(-1)?.kind).toBe("Decomposition");
  const resultDots = [...result.atoms.map(a => a.cells).join("")].map(c => {
    const bits = c.charCodeAt(0) - 0x2800;
    return bits ? [1,2,3,4,5,6].filter(d => bits & (1 << (d - 1))).join("") : "SP";
  }).join(",");
  expect(resultDots).toContain(`${arrow},456,125,23,135,SP,235,456,14,135,23,56,34,156`);
  for (const atom of result.atoms) {
    expect(atom.span.start).toBeGreaterThanOrEqual(17);
    expect(atom.span.end).toBeLessThanOrEqual(17 + raw.length);
  }
});
test.each([
  "\\decompabove{H2O}",
  "H2CO3\\decompbelow{}",
  "H2CO3\\decompabove{C_{n*m}}",
  "H2CO3\\decompabove{H2O",
  "H2CO3\\decompabove{H2O\\decompbelow{CO2}}",
  "H2CO3\\decompabove{H2O}CO2",
])("invalid or unsupported decomposition stays incomplete %s", raw => {
  const result = convert(raw);
  expect(result.complete).toBe(false);
  expect(result.diagnostics.length).toBeGreaterThan(0);
  expect(result.unhandled.length).toBeGreaterThan(0);
});
