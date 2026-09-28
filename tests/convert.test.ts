import { it, expect } from "vitest";
import {
  convert,
  encodeDocument,
  reflowExistingAtoms,
} from "../packages/core/src/convert";
import { encodeMath } from "../packages/core/src/rules/math";
import { parseMath } from "../packages/core/src/parser/math";
import { encodeChemistry } from "../packages/core/src/rules/chemistry";
import { parseChemistry } from "../packages/core/src/parser/chemistry";
import { braille as b } from "../packages/core/src/rules/math-symbols";
const options = { columns: 100, paragraphIndent: 0 };
it("ordinary numeral has number prefix and no prose symbol marker", () => {
  expect(convert("27", options).unicode).toBe(b(["3456", "12", "1245"]));
});
it.each([4, 10, 30, 40])(
  "never splits a long numeral illegally at width %i",
  (columns) => {
    const r = convert("12345678901234567890", { ...options, columns });
    expect(
      r.complete
        ? r.lines.every((l: string) => l.length <= columns)
        : r.diagnostics.some((d: any) => d.code === "layout-overflow"),
    ).toBe(true);
    expect(r.atoms.length).toBeGreaterThan(0);
  },
);
it("routes Chinese, numbers and Latin in original text order and retains analysis", () => {
  const r = convert("你27abc好", options);
  expect(r.unicode.indexOf(b(["3456", "12", "1245"]))).toBeGreaterThan(0);
  expect(r.metadata.chineseWords.map((w: any) => w.raw).join("")).toContain(
    "你27abc好",
  );
  expect(r.metadata.chineseWords.some((w: any) => w.syllables.length)).toBe(
    true,
  );
});
it("preserves unknown and escaped source with visible errors and placeholders", () => {
  for (const s of ["😀", "\\$", "$\\unknown{x}$"]) {
    const r = convert(s, options);
    expect(r.complete).toBe(false);
    expect(r.unhandled.length).toBeGreaterThan(0);
    expect(r.unicode).toContain(b(["123456"]));
    expect(r.document.source).toBe(s);
  }
});
it("preserves isotope semantic order through explicit ce routing", () => {
  const raw = "^{12}_{6}C";
  const expected = encodeChemistry(parseChemistry(raw))
    .atoms.map((a) => a.cells)
    .join("");
  expect(convert(`\\ce{${raw}}`, options).unicode).toBe(expected);
});
it("frames chemical formulas in prose conservatively without adding math closing markers", () => {
  const r = convert("你\\ce{H2O}你", options);
  expect(r.unicode).toContain(b(["46"]));
  expect(r.unicode).toContain(b(["156", "0"]));
  const m = convert("你$x$你", options);
  expect(m.unicode).not.toContain(b(["156"]));
});
it("propagates chemical incomplete independent of unhandled length", () => {
  const r = convert("C ->[化] O", { ...options, mode: "chemistry" });
  expect(r.complete).toBe(false);
  expect(r.diagnostics.some((d: any) => d.code === "CHINESE_POLYPHONY")).toBe(
    true,
  );
});
it("exposes normalization profile with one visible informational notice", () => {
  const r = convert("$p+\\mathrm{p}$", options);
  expect(r.metadata.fontProfile).toBe("roman-light-normalized");
  expect(
    r.diagnostics.filter((d: any) => d.code === "font-normalization-profile"),
  ).toHaveLength(1);
});
it("reflows preencoded atoms without semantic mutation", () => {
  const e = encodeDocument("你27好", options);
  const before = JSON.stringify(e);
  const r = reflowExistingAtoms(e, { ...options, columns: 30 });
  expect(JSON.stringify(e)).toBe(before);
  expect(r.atoms).toEqual(e.atoms);
  expect(r.lines.length).toBeGreaterThan(0);
});
it("routes explicit physics units", () => {
  expect(convert("m s", { ...options, mode: "physics" }).unicode).toBe(
    b(["56", "134", "3", "56", "234"]),
  );
});
it("math text markers are word scoped for three and four words", () => {
  for (const [raw, prefixes] of [
    ["你 你 你", [1, 1, 1]],
    ["你 你 你 你", [2, 0, 0, 1]],
  ] as const) {
    const r = encodeMath(parseMath(`\\text{${raw}}`));
    expect(r.atoms.map((a) => a.cells).join("")).toBe(
      prefixes.map((n) => b([...Array(n).fill("4"), "1345"])).join(b(["0"])),
    );
  }
});
it("outputs matrix rows as actual separate lines", () => {
  const r = convert("$\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}$", options);
  expect(r.lines).toHaveLength(2);
  for (const line of r.lines) {
    expect(line.startsWith(b(["126"]))).toBe(true);
    expect(line.endsWith(b(["345"]))).toBe(true);
  }
});
it("reading revisions reach embedded math and chemistry without changing word boundaries", () => {
  const revision = (analysis: any) => ({
    ...analysis,
    diagnostics: analysis.diagnostics.filter(
      (d: any) => d.code !== "CHINESE_POLYPHONY",
    ),
    words: analysis.words.map((w: any) => ({
      ...w,
      syllables: w.syllables.map((s: any) => ({
        ...s,
        reading: s.raw === "重" ? "chong2" : s.reading,
        source: "manual",
      })),
    })),
  });
  for (const source of ["$\\text{重量}$", "\\ce{C ->[重量] O}"]) {
    const original = convert(source, options),
      edited = convert(source, { ...options, analyze: revision });
    expect(edited.unicode).not.toBe(original.unicode);
    const words = (r: any) =>
      r.metadata.chineseWords
        .filter((w: any) => w.kind === "chinese")
        .map((w: any) => ({ raw: w.raw, span: w.span }));
    expect(words(edited)).toEqual(words(original));
    expect(words(edited)).toHaveLength(1);
    expect(
      edited.metadata.chineseWords
        .flatMap((w: any) => w.syllables)
        .find((s: any) => s.raw === "重")?.reading,
    ).toBe("chong2");
  }
});
it("implements checked punctuation afterspace, ellipsis exceptions and meaningful Han-width space", () => {
  expect(convert("a，b、c；d：e", options).unicode).toBe(
    b([
      "56",
      "1",
      "5",
      "0",
      "56",
      "12",
      "4",
      "0",
      "56",
      "14",
      "56",
      "0",
      "56",
      "145",
      "36",
      "0",
      "56",
      "15",
    ]),
  );
  expect(convert("a……b", options).unicode).toBe(
    b(["56", "1", "5", "5", "5", "0", "56", "12"]),
  );
  expect(convert("a……。", options).unicode).toBe(
    b(["56", "1", "5", "5", "5", "5", "23"]),
  );
  expect(convert("a　b", options).unicode).toBe(
    b(["56", "1", "0", "0", "56", "12"]),
  );
});
it("keeps interpunct away from line start and quote cell pairs atomic", () => {
  const r = convert("a·b", { ...options, columns: 3 });
  expect(r.complete).toBe(false);
  expect(r.diagnostics.some((d) => d.code === "layout-overflow")).toBe(true);
  const q = convert("a‘你’", { ...options, columns: 2 });
  expect(q.complete).toBe(true);
  expect(
    q.lines
      .filter((line) => line.includes(b(["45"])))
      .every((line) => line.includes(b(["45", "45"]))),
  ).toBe(true);
  expect(convert("‘", { ...options, columns: 1 }).complete).toBe(false);
});
it("matrix source-row wraps indent two cells and cases use the explicit linear convention", () => {
  const r = convert("$\\begin{pmatrix}a&b&c\\\\d&e&f\\end{pmatrix}$", {
    ...options,
    columns: 6,
  });
  expect(r.complete).toBe(true);
  expect(r.lines.length).toBeGreaterThan(2);
  expect(r.lines[1].startsWith(b(["0", "0"]))).toBe(true);
  const c = convert("$\\begin{cases}a&b\\\\c&d\\end{cases}$", options);
  expect(c.unicode).toContain(b(["46", "1256"]));
  expect(c.complete).toBe(true);
});
it("protects structural math prefixes with their required payload", () => {
  const r = convert("$\\sqrt{x}$", { ...options, columns: 4 });
  expect(r.complete).toBe(false);
  expect(r.diagnostics.some((d) => d.code === "layout-overflow")).toBe(true);
  expect(r.lines).toEqual([]);
});
it("diagnoses nested matrix placement outside the verified row profile", () => {
  const r = convert(
    "$\\frac{\\begin{pmatrix}a\\\\b\\end{pmatrix}}{2}$",
    options,
  );
  expect(r.complete).toBe(false);
  expect(
    r.diagnostics.some((d) => d.code === "math-matrix-context-unverified"),
  ).toBe(true);
});
it("shares a single required blank with source whitespace across a math boundary", () => {
  const a = convert("你$x$ 你", options),
    c = convert("你$x$你", options);
  expect(a.unicode).toBe(c.unicode);
});
it("global reading overrides are routed only to their source scope", () => {
  const source = "你 $\\text{重量}$";
  const r = convert(source, {
    ...options,
    overrides: [{ start: 9, end: 11, readings: ["chong2", "liang4"] }],
  });
  expect(r.diagnostics.some((d) => d.code === "CHINESE_INVALID_OVERRIDE")).toBe(
    false,
  );
  expect(
    r.metadata.chineseWords
      .flatMap((w) => w.syllables)
      .find((s) => s.raw === "重")?.reading,
  ).toBe("chong2");
});
it("Chinese metadata survives the chemistry callback nested in math", () => {
  const r = convert("$\\ce{C ->[重量] O}$", options);
  expect(r.metadata.chineseWords.some((w) => w.raw === "重量")).toBe(true);
});
it("escaped tokens, CRLF and supplementary scalars retain original UTF16 source spans", () => {
  const r = convert("\\$27\r\n😀", options);
  expect(
    r.atoms.find((a) => a.ruleId === "unhandled-placeholder")?.span,
  ).toEqual({ start: 0, end: 2 });
  expect(
    r.atoms.find(
      (a) => a.kind === "cell" && a.cells === b(["3456", "12", "1245"]),
    )?.span,
  ).toEqual({ start: 2, end: 4 });
  expect(r.document.nodes.find((n) => n.kind === "line-break")?.span).toEqual({
    start: 4,
    end: 6,
  });
  expect(r.unhandled.at(-1)?.span).toEqual({ start: 6, end: 8 });
});
it("rejects malformed or out-of-source reading overrides instead of silently ignoring them", () => {
  for (const override of [
    { start: NaN, end: 1, readings: ["ni3"] },
    { start: 0, end: 99, readings: ["ni3"] },
    { start: 1, end: 1, readings: [] },
  ]) {
    const r = convert("你", { ...options, overrides: [override] });
    expect(r.complete).toBe(false);
    expect(
      r.diagnostics.some((d) => d.code === "CHINESE_INVALID_OVERRIDE"),
    ).toBe(true);
  }
});
it("display boundaries do not manufacture trailing or duplicate source blank lines", () => {
  const r = convert("$$x$$", options);
  expect(r.lines).toEqual([b(["56", "1346"])]);
  expect(convert("你$$x$$你", options).lines).toEqual([
    b(["1345"]),
    b(["56", "1346"]),
    b(["1345"]),
  ]);
  expect(convert("$$x$$\n你", options).lines).toEqual([
    b(["56", "1346"]),
    b(["1345"]),
  ]);
});
it("does not claim multi-matrix page composition is complete", () => {
  const r = convert(
    "$\\begin{pmatrix}a\\end{pmatrix}+\\begin{pmatrix}b\\end{pmatrix}$",
    options,
  );
  expect(r.complete).toBe(false);
  expect(
    r.diagnostics.some((d) => d.code === "math-matrix-composition-unverified"),
  ).toBe(true);
});
it("keeps a supported matrix exponent after the last row without merging atomic groups across rows", () => {
  const r = convert("$\\begin{pmatrix}a\\\\b\\end{pmatrix}^2$", options);
  expect(r.complete).toBe(true);
  expect(r.lines).toHaveLength(2);
  expect(r.lines[1].endsWith(b(["345", "34", "23"]))).toBe(true);
});
it("diagnoses a cross-domain interpunct conflicting with required formula spacing", () => {
  const source = "你$x$·b",
    r = convert(source, { columns: 5, paragraphIndent: 0 });
  expect(r.complete).toBe(false);
  expect(
    r.diagnostics.some(
      (d) =>
        d.code === "interpunct-adjacency-unverified" &&
        d.span.start === 4 &&
        d.span.end === 5,
    ),
  ).toBe(true);
  expect(
    r.atoms.some(
      (a) =>
        a.kind === "cell" &&
        a.cells === b(["0"]) &&
        a.span.start === 4 &&
        a.span.end === 4,
    ),
  ).toBe(true);
});
it.each([
  "你$\\ce{H2O}+\\frac{1}{2}$你",
  "你$\\ce{H2O}+\\ce{CO2}$你",
  "你$\\ce{H2O}+\\sqrt{\\frac{1}{2}}$你",
])(
  "does not frame mixed chemical and mathematical scopes as one chemical formula: %s",
  (source) => {
    const r = convert(source, options);
    expect(r.complete).toBe(false);
    expect(
      r.diagnostics.some((d) => d.code === "mixed-chemistry-prose-unverified"),
    ).toBe(true);
    const finalMath = r.atoms
      .filter(
        (a) =>
          a.kind === "cell" &&
          a.span.end < source.length - 1 &&
          !/^\u2800+$/.test(a.cells),
      )
      .at(-1);
    expect(
      finalMath?.kind === "cell" && finalMath.cells.endsWith(b(["156"])),
    ).toBe(false);
  },
);
it.each(["你$\\ce{SO4^{2-}}$你", "你$  \\ce{Al2(SO4)3}  $你"])(
  "retains true whole-ce nested-brace framing: %s",
  (source) => {
    const r = convert(source, options);
    expect(r.complete).toBe(true);
    expect(
      r.diagnostics.some((d) => d.code === "mixed-chemistry-prose-unverified"),
    ).toBe(false);
    expect(r.unicode).toContain(b(["156", "0", "1345"]));
  },
);
