import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  parseChemistry,
  ELEMENT_SYMBOLS,
} from "../packages/core/src/parser/chemistry";
import {
  encodeChemistry,
  chemistryMathHook,
} from "../packages/core/src/rules/chemistry";
import { parseMath } from "../packages/core/src/parser/math";
import { encodeMath } from "../packages/core/src/rules/math";
import { analyzeChineseDetailed } from "../packages/core/src/language/chinese";
import { encodeChineseDetailed } from "../packages/core/src/rules/chinese";
const convert = (raw: string, start = 0) =>
  encodeChemistry(parseChemistry(raw, { start, end: start + raw.length }));
const dots = (cells: string) =>
  Array.from(cells, (c) => {
    let bits = c.charCodeAt(0) - 0x2800;
    return bits === 0
      ? "SP"
      : Array.from({ length: 6 }, (_, i) =>
          bits & (1 << i) ? String(i + 1) : "",
        ).join("");
  });
const output = (raw: string) =>
  dots(
    convert(raw)
      .atoms.map((a) => a.cells)
      .join(""),
  ).join(",");
// Independently transcribed short official examples, chemical context; no legacy oracle.
export const chemicalFacts = [
  ["Co", "6,14,135", "8.1.2.1"],
  ["CO", "456,14,135", "8.2.2.2"],
  ["HCl", "6,125,6,14,123", "8.2.2.3"],
  ["HCOONa", "456,125,14,135,135,6,1345,1", "8.2.2.3"],
  ["H2SO4", "456,125,23,234,135,256", "8.2.2.4"],
  ["Al2(SO4)3", "6,1,123,23,126,456,234,135,256,345,25", "8.2.2.4"],
  ["2HCl", "3456,12,6,125,6,14,123", "8.2.2.8"],
  ["NH4+", "456,1345,125,256,46,235", "8.2.2.6"],
  ["SO4^{2-}", "456,234,135,256,46,3456,12,36", "8.2.2.6"],
  ["Fe^{3+}", "6,124,15,46,3456,14,6,235", "8.1.2.3"],
  ["^{12}_{6}C", "16,235,34,2,23,6,14", "8.1.2.2"],
  [
    "Na2CO3·10H2O",
    "6,1345,1,23,456,14,135,25,6,3,3456,1,245,456,125,23,135",
    "8.2.2.7",
  ],
  ["H-O-H", "6,125,36,6,135,36,6,125", "8.4.2.1"],
  ["N#N", "6,1345,123456,6,1345", "8.4.2.1"],
  ["O=O", "6,135,1346,6,135", "8.4.2.1"],
  ["(g)", "126,56,1245,345", "8.2.1"],
  ["(l)", "126,56,123,345", "8.2.1"],
  ["(s)", "126,56,234,345", "8.2.1"],
  ["(aq)", "126,56,1,12345,345", "8.2.1"],
  ["H2↑", "6,125,23,56,34", "8.2.2.8"],
  ["AgCl↓", "6,1,1245,6,14,123,45,16", "8.2.2.8"],
  ["C_n", "6,14,16,56,1345,156", "8.2.2.4"],
] as const;
test.each(chemicalFacts)("official fact %s", (raw, want) => {
  expect(output(raw)).toBe(want);
  expect(convert(raw).complete).toBe(true);
});
test.each([
  ["Co", ["Element"]],
  ["CO", ["Element", "Element"]],
  [
    "2H2 + O2 -> 2H2O",
    [
      "Coefficient",
      "Element",
      "Count",
      "Whitespace",
      "Addition",
      "Whitespace",
      "Element",
      "Count",
      "Whitespace",
      "ReactionArrow",
      "Whitespace",
      "Coefficient",
      "Element",
      "Count",
      "Element",
    ],
  ],
])("typed structure %s", (raw, kinds) =>
  expect(parseChemistry(raw as string).children.map((n) => n.kind)).toEqual(
    kinds,
  ),
);
test("global spans and raw preserve every nested source character", () => {
  const raw = "  K4[Fe(CN)6]  ",
    root = parseChemistry(raw, { start: 71, end: 71 + raw.length });
  expect(root.children.map((n) => n.raw).join("")).toBe(raw);
  const walk = (nodes: any[]) => {
    for (const n of nodes) {
      expect(n.raw).toBe(raw.slice(n.span.start - 71, n.span.end - 71));
      if (n.children) walk(n.children);
    }
  };
  walk(root.children);
  expect(convert(raw).complete).toBe(true);
});
test.each(["H2 + O2 -> H2O", "Na+ + Cl- -> NaCl", "NH4+ + Cl- -> NH4Cl"])(
  "addition is separate from terminal charge %s",
  (raw) => {
    const root = parseChemistry(raw);
    expect(root.children.filter((n) => n.kind === "Addition")).toHaveLength(1);
    expect(convert(raw).complete).toBe(true);
  },
);
test("compact single-element charge ambiguity remains explicit", () => {
  const r = convert("Fe3+");
  expect(r.complete).toBe(false);
  expect(
    r.diagnostics.some((d) => d.code === "chemistry-ambiguous-charge"),
  ).toBe(true);
  expect(r.unhandled.map((n) => n.raw).join("")).toContain("3+");
});
test.each([
  "Xx2",
  "Fe(OH",
  "H2]",
  "H😀",
  "\\unknown{H2}",
  "\\lewis{H:O:H}",
  "\\chemgraph{C-C}",
  "\\orbital{up}",
])("invalid and unsupported source is retained %s", (raw) => {
  const n = parseChemistry(raw, { start: 12, end: 12 + raw.length }),
    r = encodeChemistry(n);
  expect(n.children.map((n) => n.raw).join("")).toBe(raw);
  expect(r.complete).toBe(false);
  expect(r.diagnostics.length).toBeGreaterThan(0);
  expect(r.unhandled.length).toBeGreaterThan(0);
  expect(r.diagnostics.every((d) => d.span.start >= 12)).toBe(true);
});
test.each([
  ["->", "SP,25,135"],
  ["→", "SP,25,135"],
  ["<-", "SP,246,25"],
  ["←", "SP,246,25"],
  ["<=>", "6,2356,2"],
  ["⇌", "6,2356,2"],
  ["⇋", "5,2356,3"],
])("reaction spacing %s", (arrow, want) =>
  expect(output(`C ${arrow} O`)).toBe(`6,14,${want},6,135`),
);
test("reaction equals is explicit and differs from bond", () => {
  expect(output("C = O")).toBe("6,14,SP,2356,6,135");
  expect(output("C=O")).toBe("6,14,1346,6,135");
});
test("heat above reaction equals has checked annotation framing", () =>
  expect(output("C =[Δ] O")).toBe("6,14,SP,2356,45,456,256,156,6,135"));
test("Chinese above/below conditions delegate with exact wrapper offsets", () => {
  const raw = "\\ce{C ->[\\text{放电}][充电] O}",
    r = convert(raw, 100);
  expect(r.complete).toBe(true);
  for (const word of ["放电", "充电"]) {
    const offset = 100 + raw.indexOf(word),
      ch = encodeChineseDetailed(
        analyzeChineseDetailed(word, [], offset).words,
      );
    const payload = r.atoms.filter(
      (a) => a.span.start >= offset && a.span.end <= offset + 2,
    );
    expect(payload.map((a) => a.cells).join("")).toBe(
      ch.atoms.map((a) => a.cells).join(""),
    );
  }
  const all = dots(r.atoms.map((a) => a.cells).join("")).join(",");
  expect(all).toContain("25,135,45,4,");
  expect(all).toContain("6,156,56,4,");
  expect(all).toContain("6,156,6,135");
});
test("unverified condition text stays visibly incomplete", () => {
  const r = convert("C ->[😀] O");
  expect(r.complete).toBe(false);
  expect(r.unhandled.some((n) => n.raw.includes("😀"))).toBe(true);
});
test("explicit electron is not an invalid element", () => {
  expect(output("e-")).toBe("56,15,46,36");
  expect(convert("e-").complete).toBe(true);
});
test("all atoms are six-dot and formula/charge groups cannot split", () => {
  const r = convert("SO4^{2-} -> H2O");
  expect(r.atoms.every((a) => /^[\u2800-\u283f]+$/u.test(a.cells))).toBe(true);
  const ion = r.atoms.filter((a) => a.span.end <= 8);
  expect(new Set(ion.map((a) => a.group)).size).toBe(1);
  expect(r.atoms.some((a) => a.breakAfter)).toBe(true);
});
test("bounded recursion and length retain source without throwing", () => {
  for (const [raw, options] of [
    ["(".repeat(100) + "H" + ")".repeat(100), { maxDepth: 5 }],
    ["H".repeat(30), { maxLength: 10 }],
  ] as const) {
    const n = parseChemistry(raw, undefined, options);
    expect(n.raw).toBe(raw);
    expect(encodeChemistry(n).complete).toBe(false);
    expect(
      n.diagnostics.some((d) => d.code === "chemistry-resource-limit"),
    ).toBe(true);
  }
});
test("stateless sequential/concurrent encodings", async () => {
  const a = convert("HCOONa");
  convert("Na^{+}");
  expect(convert("HCOONa")).toEqual(a);
  expect(
    await Promise.all([
      Promise.resolve(convert("HCOONa")),
      Promise.resolve(convert("HCOONa")),
    ]),
  ).toEqual([a, a]);
});
test("math ce hook performs actual conversion and propagates unsupported source", () => {
  const r = encodeMath(parseMath("x+\\ce{H2O}", { start: 20, end: 30 }), {
    chemistry: chemistryMathHook,
  });
  expect(r.complete).toBe(true);
  expect(r.atoms.map((a) => a.cells).join("")).toContain(
    convert("H2O")
      .atoms.map((a) => a.cells)
      .join(""),
  );
  expect(
    r.atoms
      .filter((a) => a.ruleId.includes("8."))
      .every((a) => a.span.start >= 26),
  ).toBe(true);
  const bad = encodeMath(parseMath("\\ce{Fe3+}"), {
    chemistry: chemistryMathHook,
  });
  expect(bad.complete).toBe(false);
  expect(bad.unhandled.some((n) => n.raw.includes("3+"))).toBe(true);
});
test("118 modern elements each parse and encode; legacy temporary names remain explicit", () => {
  expect(ELEMENT_SYMBOLS.length).toBe(118);
  for (const s of ELEMENT_SYMBOLS) {
    expect(parseChemistry(s).children[0].kind, s).toBe("Element");
    expect(convert(s).complete, s).toBe(true);
    expect(convert(s).atoms.length, s).toBeGreaterThan(0);
  }
  expect(convert("Unh").complete).toBe(false);
});
test.each([
  "#H",
  "H#",
  "H==O",
  "2",
  "()",
  "H + + O",
  "H ->",
  "-> O",
  "H·",
  "H^{+}Cl",
  "H_2_3",
  "(H -> O)",
  "H0",
  "0H",
])("malformed grammar cannot report complete %s", (raw) => {
  const r = convert(raw);
  expect(r.complete).toBe(false);
  expect(r.diagnostics.length).toBeGreaterThan(0);
  expect(r.unhandled.length).toBeGreaterThan(0);
});
test("single element count followed by addition is not a compact charge", () => {
  expect(convert("H2+O2->H2O").complete).toBe(true);
  expect(
    parseChemistry("H2+O2->H2O").children.filter((n) => n.kind === "Addition"),
  ).toHaveLength(1);
});
// Derived from the printed C_nH_{2n+2} capitalization in §8.2.2.4, p62.
test("symbolic count retains the chemical continuous capital run", () =>
  expect(output("C_nH2")).toBe("456,14,16,56,1345,156,125,23"));
test("only a directly preceding chemical symbol triggers isotope separator", () => {
  expect(output("H -> ^{12}_{6}C")).toBe("6,125,SP,25,135,16,235,34,2,23,6,14");
  expect(output("2^{12}_{6}C")).toBe("3456,12,6,16,235,34,2,23,6,14");
});
test("empty above slot permits below-only condition", () => {
  expect(output("H ->[][Δ] H")).toBe("6,125,SP,25,135,56,456,256,156,6,125");
  expect(convert("H ->[][Δ] H").complete).toBe(true);
});
test("unknown supplementary scalar has one exact global source unit", () => {
  const r = convert("H😀", 43),
    u = r.unhandled.find((n) => n.raw === "😀");
  expect(u?.span).toEqual({ start: 44, end: 46 });
});
test("multiword condition text marker follows word count", () => {
  for (const [words, markers] of [
    ["加热 催化", "4,4"],
    ["加热 催化 高温 高压", "4,4,4"],
  ]) {
    const raw = `H ->[${words}] H`,
      r = convert(raw),
      framing = r.atoms
        .filter((a) => a.ruleId === "GBT18028-2010-8.2.2.9")
        .flatMap((a) => dots(a.cells))
        .filter((d) => d === "4");
    expect(framing.join(",")).toBe(markers);
    expect(r.complete).toBe(false);
    expect(r.diagnostics.some((d) => d.code === "CHINESE_POLYPHONY")).toBe(
      true,
    );
  }
});
test("nonfinite depth cannot disable resource guard", () => {
  const raw = "(".repeat(150) + "H" + ")".repeat(150);
  expect(
    encodeChemistry(parseChemistry(raw, undefined, { maxDepth: NaN })).complete,
  ).toBe(false);
});
test("polyatomic charge atoms cite their molecular clause", () => {
  expect(convert("SO4^{2-}").atoms.at(-1)?.ruleId).toBe(
    "GBT18028-2010-8.2.2.6",
  );
  expect(convert("Fe^{3+}").atoms.at(-1)?.ruleId).toBe("GBT18028-2010-8.1.2.3");
});
const standardFixtures = JSON.parse(
  readFileSync("tests/standards/gb18028-chemistry.json", "utf8"),
) as {
  id: string;
  input: string;
  expectedDots: string[];
  ruleId: string;
  forbiddenRuleIds?: string[];
  forbiddenSemanticKinds?: string[];
  forbiddenDots?: string[];
}[];
test.each(standardFixtures)("registered independent fixture $id", (f) => {
  expect(output(f.input)).toBe(f.expectedDots.join(","));
  const result = convert(f.input);
  expect(result.complete).toBe(true);
  for (const rule of f.forbiddenRuleIds ?? [])
    expect(result.atoms.some((a) => a.ruleId === rule)).toBe(false);
  for (const kind of f.forbiddenSemanticKinds ?? [])
    expect(parseChemistry(f.input).children.some((n) => n.kind === kind)).toBe(
      false,
    );
  for (const cell of f.forbiddenDots ?? [])
    expect(dots(result.atoms.map((a) => a.cells).join(""))).not.toContain(cell);
});
test("all emitted chemistry rule IDs are registered with honest partial coverage", () => {
  const rules = JSON.parse(readFileSync("standards/registry.json", "utf8"));
  for (const f of standardFixtures)
    for (const a of convert(f.input).atoms) {
      expect(rules.find((r: any) => r.id === a.ruleId)?.status, a.ruleId).toBe(
        "implemented-unverified",
      );
    }
  expect(
    JSON.parse(readFileSync("standards/coverage.json", "utf8"))
      .fullStandardSupport,
  ).toBe(false);
});
test("double-headed resonance arrow is not silently changed to equilibrium", () => {
  const r = convert("C <-> O");
  expect(r.complete).toBe(false);
  expect(r.unhandled.some((n) => n.raw === "<->")).toBe(true);
});

test.each([
  "Fe3+(aq)",
  "Fe3+(g)",
  "Fe3+->Fe",
  "Fe3+<-Fe",
  "Fe3+<=>Fe",
  "Fe3+=>Fe",
  "Fe3+ = Fe",
  "Fe3+→Fe",
  "Fe3+←Fe",
  "Fe3+⇌Fe",
  "Fe3+⇋Fe",
  "Fe3−",
  "Fe3−(aq)",
  "Fe3−->Fe",
  "(Fe3+)",
  "[Fe3−]",
  "Fe3+ + Cl-",
])("compact charge ambiguity survives terminal context %s", (raw) => {
  const root = parseChemistry(raw, { start: 40, end: 40 + raw.length });
  const result = encodeChemistry(root);
  expect(result.complete).toBe(false);
  const sign = raw.includes("−") ? "−" : "+";
  const token = "3" + sign;
  const position = 40 + raw.indexOf(token);
  expect(
    result.diagnostics.some(
      (d) =>
        d.code === "chemistry-ambiguous-charge" &&
        d.span.start === position &&
        d.span.end === position + 2,
    ),
  ).toBe(true);
  expect(result.unhandled.some((n) => n.raw === token)).toBe(true);
});
test.each([
  "Fe^{3+}(aq)",
  "Fe^{3+}(g)",
  "Fe^{3+}->Fe",
  "Fe^{3+}<-Fe",
  "Fe^{3+}<=>Fe",
  "Fe^{3+}=>Fe",
  "Fe^{3+} = Fe",
  "Fe^{3+}→Fe",
  "Fe^{3+}←Fe",
  "Fe^{3+}⇌Fe",
  "Fe^{3+}⇋Fe",
  "Fe^{3-}",
  "Fe^{3-}(aq)",
  "Fe^{3-}->Fe",
  "(Fe^{3+})",
  "[Fe^{3-}]",
  "Fe^{3+} + Cl-",
  "Fe3->Fe",
  "Fe3+Cl",
  "NH4+(aq)",
])("explicit charge/count retains intended interpretation %s", (raw) => {
  const result = convert(raw);
  expect(result.complete).toBe(true);
  expect(
    result.diagnostics.some((d) => d.code === "chemistry-ambiguous-charge"),
  ).toBe(false);
});
