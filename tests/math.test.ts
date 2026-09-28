import { describe, it, expect } from "vitest";
import { parseMath } from "../packages/core/src/parser/math";
import { encodeMath } from "../packages/core/src/rules/math";
import { encodePhysics } from "../packages/core/src/rules/physics";
import legacy from "./standards/legacy-math.json";
const dots = (s: string) =>
  Array.from(s, (c) => {
    const n = c.charCodeAt(0) - 0x2800;
    return [1, 2, 3, 4, 5, 6].filter((d) => n & (1 << (d - 1))).join("") || "0";
  });
const convert = (s: string) => encodeMath(parseMath(s));
const output = (s: string) =>
  dots(
    convert(s)
      .atoms.map((a) => a.cells)
      .join(""),
  );
describe("math semantic safety", () => {
  it("retains unknown command with exact global span", () => {
    const r = encodeMath(parseMath("a+\\mystery{中}", { start: 20, end: 33 }));
    expect(r.complete).toBe(false);
    expect(
      r.diagnostics.some(
        (d) => d.code === "math-unknown-command" && d.span.start === 22,
      ),
    ).toBe(true);
    expect(r.unhandled.some((n) => n.raw.includes("\\mystery"))).toBe(true);
  });
  it("delegates formula Chinese text without losing it", () => {
    const r = convert("\\text{中国}");
    expect(r.atoms.length).toBeGreaterThan(1);
    expect(r.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });
  it("bounds nested parsing and retains remainder", () => {
    const r = parseMath("{".repeat(100) + "x" + "}".repeat(100), undefined, {
      maxDepth: 8,
    });
    expect(r.diagnostics.some((d) => d.code === "math-depth-limit")).toBe(true);
  });
  it("bounds input size", () => {
    const r = parseMath("x".repeat(100), undefined, { maxLength: 10 });
    expect(r.diagnostics.some((d) => d.code === "math-length-limit")).toBe(
      true,
    );
  });
  it.each(["{a", "a}", "\\begin{matrix}a&b", "\\frac{a}"])(
    "diagnoses malformed %s",
    (s) => expect(convert(s).complete).toBe(false),
  );
  it("restores letter state after nested expressions", () =>
    expect(output("a^{b}a")).toEqual([
      "56",
      "1",
      "34",
      "56",
      "12",
      "156",
      "56",
      "1",
    ]));
  it("isolates sequential and concurrent calls", async () => {
    const first = convert("x^2");
    await Promise.all(
      ["a+b", "\\sqrt{a}", "\\text{中国}"].map(async (s) => convert(s)),
    );
    expect(convert("x^2")).toEqual(first);
    expect(first.atoms.length).toBeGreaterThan(0);
  });
  it("exposes chemistry as retained delegated node", () => {
    const r = convert("\\ce{H2O}");
    expect(r.complete).toBe(false);
    expect(r.unhandled[0].raw).toBe("\\ce{H2O}");
  });
});
describe("independent standard facts", () => {
  // GB/T 18028-2010 §6.18.1–2, printed pp. 38–39: the negative set
  // relations have no surrounding blank; order relations have distinct
  // both-side versus before-only spacing. These are not interchangeable.
  it.each([
    ["a\\nsubset b", ["56", "1", "4", "12346", "56", "12"]],
    ["a\\nsupset b", ["56", "1", "4", "1456", "56", "12"]],
    ["a\\sqsubset b", ["56", "1", "0", "12346", "12346", "0", "56", "12"]],
    ["a\\sqsupset b", ["56", "1", "0", "1456", "1456", "0", "56", "12"]],
    ["a\\prec b", ["56", "1", "0", "25", "246", "0", "56", "12"]],
    ["a\\succ b", ["56", "1", "0", "135", "25", "0", "56", "12"]],
    ["a\\preceq b", ["56", "1", "0", "25", "246", "2356", "56", "12"]],
    ["a\\succeq b", ["56", "1", "0", "135", "25", "2356", "56", "12"]],
    ["f\\mapsto x", ["56", "124", "456", "25", "135", "56", "1346"]],
    ["f\\leftrightarrow x", ["56", "124", "246", "25", "135", "56", "1346"]],
  ] as [string, string[]][])("set relation %s", (input, expected) =>
    expect(output(input)).toEqual(expected),
  );
  it.each([
    ["⊄", "\\nsubset"], ["⊅", "\\nsupset"],
    ["⊏", "\\sqsubset"], ["⊐", "\\sqsupset"],
    ["≺", "\\prec"], ["≻", "\\succ"],
    ["≼", "\\preceq"], ["≽", "\\succeq"],
    ["↦", "\\mapsto"], ["↔", "\\leftrightarrow"],
  ])("Unicode %s matches TeX %s", (glyph, command) =>
    expect(output(`a${glyph}b`)).toEqual(output(`a${command} b`)),
  );
  it.each([
    ["376", ["3456", "14", "1245", "124"]],
    ["\\frac{13}{28}", ["3456", "1", "14", "23", "236"]],
    ["a^2", ["56", "1", "34", "23"]],
    ["\\sqrt{a}", ["146", "156", "56", "1", "1456"]],
    ["\\sin a", ["1246", "234", "56", "1"]],
    ["abB", ["56", "1", "12", "6", "12"]],
    ["\\alpha\\beta", ["46", "1", "12"]],
    ["a+b", ["56", "1", "0", "235", "56", "12"]],
    ["x=+3", ["56", "1346", "0", "2356", "235", "3456", "14"]],
    ["a\\neq b", ["56", "1", "4", "2356", "56", "12"]],
    ["a<b", ["56", "1", "0", "246", "0", "56", "12"]],
    ["\\frac{a}{b}", ["56", "1", "1256", "56", "12"]],
    [
      "\\frac{a+b}{c}",
      ["23", "56", "1", "0", "235", "56", "12", "0", "1256", "56", "14", "56"],
    ],
    [
      "x_{1,2}",
      ["56", "1346", "16", "3456", "1", "5", "0", "3456", "12", "156"],
    ],
    ["\\sqrt[3]{x}", ["146", "25", "156", "56", "1346", "1456"]],
    [
      "0.\\dot{1}4285\\dot{7}",
      ["3456", "245", "2", "5", "1", "145", "12", "125", "15", "1245"],
    ],
    ["\\because a", ["0", "16", "1", "0", "0", "56", "1"]],
    [
      "\\int_0^1 x^2",
      ["2346", "46", "16", "356", "46", "34", "2", "56", "1346", "34", "23"],
    ],
    [
      "\\max a_n",
      ["1246", "134", "1346", "56", "1", "16", "56", "1345", "156"],
    ],
    [
      "\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}",
      [
        "126",
        "56",
        "1",
        "0",
        "56",
        "12",
        "345",
        "46",
        "1256",
        "126",
        "56",
        "14",
        "0",
        "56",
        "145",
        "345",
      ],
    ],
  ] as [string, string[]][])("%s", (input, expected) =>
    expect(output(input)).toEqual(expected),
  );
  it("gives nonblank legal breaks dot6 continuation and protects number", () => {
    const r = convert("123a+b");
    expect(r.atoms.find((a) => a.cells.includes("⠼"))?.cells).toBe("⠼⠁⠃⠉");
    expect(
      r.atoms.some((a) => a.breakAfter && a.continuation?.lineEnd === "⠠"),
    ).toBe(true);
  });
  it.each(legacy.cases)("legacy engine execution $id", ({ input }) => {
    const r = convert(input);
    expect(r.atoms.length).toBeGreaterThan(0);
    expect(r.atoms.every((a) => /^[\u2800-\u283f]+$/.test(a.cells))).toBe(true);
    expect(r.diagnostics.some((d) => d.code === "math-unknown-command")).toBe(
      false,
    );
  });
});
describe("explicit physics semantics", () => {
  it.each([
    ["3 m", ["3456", "14", "56", "134"]],
    ["5 kg", ["3456", "15", "56", "13", "1245"]],
    ["3 A", ["3456", "14", "6", "1"]],
    ["m/s", ["56", "134", "6", "1256", "56", "234"]],
    ["Pa", ["6", "1234", "56", "1"]],
    [
      "kg m/s^2",
      [
        "56",
        "13",
        "1245",
        "3",
        "56",
        "134",
        "6",
        "1256",
        "56",
        "234",
        "34",
        "23",
      ],
    ],
  ] as [string, string[]][])("%s", (s, e) =>
    expect(
      dots(
        encodePhysics(s, { unit: true })
          .atoms.map((a) => a.cells)
          .join(""),
      ),
    ).toEqual(e),
  );
});

describe("semantic boundaries and nonexamples", () => {
  it.each([
    ["a\\notin A", ["56", "1", "45", "246", "6", "1"]],
    ["x^n", ["56", "1346", "34", "56", "1345", "156"]],
    [
      "\\log_2\\frac{a}{b}",
      [
        "1246",
        "123",
        "16",
        "23",
        "6",
        "23",
        "56",
        "1",
        "0",
        "1256",
        "56",
        "12",
        "56",
      ],
    ],
    [
      "\\sin\\frac{a}{b}",
      ["1246", "234", "23", "56", "1", "0", "1256", "56", "12", "56"],
    ],
    ["a≤b", ["56", "1", "0", "246", "2356", "56", "12"]],
    [
      "\\begin{bmatrix}a+b&c\\end{bmatrix}",
      ["12356", "56", "1", "5", "235", "56", "12", "0", "56", "14", "23456"],
    ],
    [
      "\\begin{cases}x&x>0\\\\0&x≤0\\end{cases}",
      [
        "246",
        "3",
        "56",
        "1346",
        "0",
        "56",
        "1346",
        "0",
        "135",
        "0",
        "3456",
        "245",
        "46",
        "1256",
        "3456",
        "245",
        "0",
        "56",
        "1346",
        "0",
        "246",
        "2356",
        "3456",
        "245",
        "4",
        "135",
      ],
    ],
  ] as [string, string[]][])("%s", (s, e) => expect(output(s)).toEqual(e));
  it("does not invent mapping for Greek glyph variants", () =>
    expect(convert("\\varepsilon").complete).toBe(false));
  it("does not silently drop explicit typography", () =>
    expect(output("\\mathbf{x}")).toEqual(["56", "12456", "1346"]));
  it("requires review for compound fraction hierarchy", () =>
    expect(convert("\\frac{a}{\\frac{b}{c}}").complete).toBe(false));
  it("rejects font-name prototype properties as commands", () =>
    expect(
      convert("\\constructor").diagnostics.some(
        (d) => d.code === "math-unknown-command",
      ),
    ).toBe(true));
  it("keeps text spaces and mixed language source ranges", () => {
    const raw = "\\text{中 a 2🙂}";
    const r = encodeMath(parseMath(raw, { start: 50, end: 50 + raw.length }));
    expect(r.atoms.some((a) => a.cells === "⠀")).toBe(true);
    expect(
      r.unhandled.some(
        (n) => n.raw === "🙂" && n.span.start === 61 && n.span.end === 63,
      ),
    ).toBe(true);
    expect(
      r.atoms.every((a) => a.span.start >= 50 && a.span.end <= 50 + raw.length),
    ).toBe(true);
  });
  it("bounds recursively nested environments", () => {
    const raw = "\\begin{matrix}".repeat(80) + "x" + "\\end{matrix}".repeat(80);
    expect(
      parseMath(raw, undefined, { maxDepth: 8 }).diagnostics.some(
        (d) => d.code === "math-depth-limit",
      ),
    ).toBe(true);
  });
  it("protects integer script direction with its number", () => {
    const a = convert("x^23").atoms;
    const direction = a.findIndex((a) => a.cells === "⠌");
    expect(a[direction].group).toBe(a[direction + 1].group);
  });
  it("retains correct UTF16 spans on supplementary unknown characters", () => {
    const r = convert("x🙂y");
    expect(r.unhandled.map((n) => n.span)).toEqual([{ start: 1, end: 3 }]);
  });
  it("treats clock-looking colon as unresolved semantics", () =>
    expect(
      convert("12:30").diagnostics.some(
        (d) => d.code === "math-colon-ambiguous",
      ),
    ).toBe(true));
  it("does not silently treat decimal dot accent as a complete recurrence without marked digits", () =>
    expect(convert("0.\\dot{x}").complete).toBe(false));
  it("diagnoses complex signed function arguments needing grouping", () =>
    expect(convert("\\sin -x").complete).toBe(false));
  it("keeps integral signs before implicit differential with letter prefix", () =>
    expect(output("\\int x dx")).toEqual([
      "2346",
      "56",
      "1346",
      "145",
      "1346",
    ]));
  it("physics handles explicit Roman compound units with TeX thinspace", () =>
    expect(
      dots(
        encodePhysics("\\mathrm{kg\\,m/s^2}", { unit: true })
          .atoms.map((a) => a.cells)
          .join(""),
      ),
    ).toEqual([
      "56",
      "1246",
      "13",
      "1245",
      "3",
      "56",
      "134",
      "6",
      "1256",
      "56",
      "234",
      "34",
      "23",
    ]));
});

describe("scoped TeX and explicit unit separators", () => {
  it("does not multiply a quantity by its unit at a TeX thinspace", () =>
    expect(
      dots(
        encodePhysics("3\\,m", { unit: true })
          .atoms.map((a) => a.cells)
          .join(""),
      ),
    ).toEqual(["3456", "14", "56", "134"]));
  it("does not let formatting become a script base", () => {
    expect(output("x\\!^2")).toEqual(output("x^2"));
    const n = parseMath("x\\!^2").body;
    expect(
      n.kind === "sequence" &&
        n.children.some((c) => c.kind === "script" && c.base.kind === "letter"),
    ).toBe(true);
  });
  it("retains unknown matrix-like layout needing review", () =>
    expect(convert("\\begin{array}{cc}a&b\\end{array}").complete).toBe(false));
  it("keeps explicit ordinary-variable d semantics without inventing differentiation", () =>
    expect(output("dx")).toEqual(["56", "145", "1346"]));
  it("forces function numerator fractions into a frame", () =>
    expect(output("\\frac{\\sin x}{a}")).toEqual([
      "23",
      "1246",
      "234",
      "56",
      "1346",
      "0",
      "1256",
      "56",
      "1",
      "56",
    ]));
  it("uses full logarithm base termination when the logarithm itself has a power", () =>
    expect(output("\\log_2^3 x")).toEqual([
      "1246",
      "123",
      "16",
      "3456",
      "12",
      "156",
      "34",
      "25",
      "56",
      "1346",
    ]));
});

import standardMath from "./standards/gb18028-math.json";
import standardPhysics from "./standards/gb18028-physics.json";
describe("registered independent official goldens", () => {
  it.each(standardMath)("$id: $input", (f) =>
    expect(output(f.input)).toEqual(f.expectedDots),
  );
  it.each(standardPhysics)("$id: $input", (f) =>
    expect(
      dots(
        encodePhysics(f.input, { unit: true })
          .atoms.map((a) => a.cells)
          .join(""),
      ),
    ).toEqual(f.expectedDots),
  );
});
import registry from "../standards/registry.json";
it("emits only registered rule identifiers", () => {
  const known = new Set(registry.map((r) => r.id));
  expect(convert("a+\\sqrt{b}").atoms.every((a) => known.has(a.ruleId))).toBe(
    true,
  );
});
it("encodes a standalone signed upper bound without a binary blank", () =>
  expect(output("\\sum_g^+")).toEqual([
    "456",
    "234",
    "46",
    "16",
    "56",
    "1245",
    "46",
    "34",
    "235",
    "156",
  ]));
it("keeps delegated incomplete chemistry incomplete even with no unhandled nodes", () => {
  const n = parseMath("\\ce{H2O}");
  expect(
    encodeMath(n, {
      chemistry: () => ({
        atoms: [],
        diagnostics: [],
        unhandled: [],
        complete: false,
      }),
    }).complete,
  ).toBe(false);
});

import ledger from "./standards/legacy-math-corrections.json";
describe("legacy comparison ledger, not official goldens", () => {
  it.each(ledger.cases)("$id", (entry) => {
    const original = legacy.cases.find((c) => c.id === entry.id)!;
    expect(entry.legacyExpected).toBe(original.expected);
    expect(entry.input).toBe(original.input);
    const result = convert(entry.input);
    expect(result.atoms.map((a) => a.cells).join("")).toBe(entry.newUnwrapped);
    expect(result.complete).toBe(entry.newComplete);
    expect(
      result.diagnostics.map((d) => ({ code: d.code, span: d.span })),
    ).toEqual(entry.diagnostics);
    expect(entry.standardCitation).toContain("GB/T18028-2010");
  });
});
it("preserves a chemistry encoder atomic group through the hook", () => {
  const n = parseMath("\\ce{H}");
  const atom = {
    kind: "cell" as const,
    cells: "⠓",
    span: { start: 4, end: 5 },
    ruleId: "chem-test",
    group: "same",
    breakBefore: false,
    breakAfter: false,
  };
  const result = encodeMath(n, {
    chemistry: () => ({
      atoms: [atom, { ...atom, cells: "⠼" }],
      diagnostics: [],
      unhandled: [],
      complete: true,
    }),
  });
  expect(result.atoms[0].group).toBe(result.atoms[1].group);
});

describe("Unicode operators share semantic roles", () => {
  it.each([
    ["∑_0^n", "\\sum_0^n"],
    ["∫_0^1 x", "\\int_0^1 x"],
    ["∏_1^n", "\\prod_1^n"],
  ])("%s matches %s", (literal, tex) =>
    expect(output(literal)).toEqual(output(tex)),
  );
  it("invalid depth option cannot disable the resource bound", () => {
    const s = "{".repeat(200) + "x" + "}".repeat(200);
    expect(
      parseMath(s, undefined, { maxDepth: NaN }).diagnostics.some(
        (d) => d.code === "math-depth-limit",
      ),
    ).toBe(true);
  });
});

describe("review round1 semantic preservation", () => {
  it.each(["0.\\dot{-1}", "0.\\dot{+1}"])(
    "retains invalid signed recurrence %s",
    (input) => {
      let result: ReturnType<typeof convert> | undefined;
      expect(() => {
        result = convert(input);
      }).not.toThrow();
      expect(result?.complete).toBe(false);
      expect(
        result?.diagnostics.some((d) => d.code === "math-invalid-recurrence"),
      ).toBe(true);
      expect(result?.unhandled.some((n) => n.raw.includes("dot"))).toBe(true);
    },
  );
  it("preserves lower annotation in a degree script", () =>
    expect(output("x_i^\\circ")).toEqual([
      "56",
      "1346",
      "16",
      "56",
      "24",
      "156",
      "5",
      "356",
    ]));
  it.each(["\\sin", "\\log_2"])(
    "normalizes transparent fraction argument groups for %s",
    (fn) =>
      expect(output(fn + "{\\frac{a}{b}}")).toEqual(
        output(fn + "\\frac{a}{b}"),
      ),
  );
  it("normalizes a grouped function before recognizing its fraction argument", () =>
    expect(output("{\\sin}{\\frac{a}{b}}")).toEqual(
      output("\\sin\\frac{a}{b}"),
    ));
  it.each(["kg {m}", "kg {m}^2", "kg m^2"])(
    "retains whitespace product before grouped/scripted unit %s",
    (input) =>
      expect(
        encodePhysics(input, { unit: true }).atoms.some((a) => a.cells === "⠄"),
      ).toBe(true),
  );
  it("visits scripted styled unit bases", () =>
    expect(
      encodePhysics("\\mathrm{kg m}^2", { unit: true }).atoms.some(
        (a) => a.cells === "⠄",
      ),
    ).toBe(true));
  it("keeps nested environments and the following outer column separate", () => {
    const n = parseMath(
      "\\begin{matrix}\\begin{matrix}a\\end{matrix}&b\\end{matrix}",
    ).body;
    expect(
      n.kind === "sequence" &&
        n.children[0].kind === "matrix" &&
        n.children[0].rows[0].length,
    ).toBe(2);
    const encoded = convert(n.raw);
    expect(encoded.complete).toBe(false);
    expect(
      encoded.diagnostics.some(
        (d) => d.code === "math-matrix-context-unverified",
      ),
    ).toBe(true);
  });
  it.each(["sin", "cos", "arctan"])("attributes %s to trigonometry", (name) =>
    expect(convert("\\" + name + " x").atoms[0].ruleId).toBe(
      "GBT18028-2010-6.9",
    ),
  );
});
describe("independent explicit font and overline facts", () => {
  it.each([
    ["\\mathrm{p}", ["56", "1246", "1234"]],
    ["\\textit a x", ["56", "146", "1", "1246", "1346"]],
    ["\\mathit{a}x", ["56", "146", "1", "1246", "1346"]],
    ["\\mathbf{a}x", ["56", "12456", "1", "1246", "1346"]],
    ["\\mathrm{ABC}", ["6", "1246", "1", "12", "14"]],
    ["\\mathrm{A}\\mathit{b}", ["6", "1246", "1", "56", "146", "12"]],
    [
      "\\mathit{a\\mathrm{b}c}d",
      ["56", "146", "1", "1246", "12", "146", "14", "1246", "145"],
    ],
    ["\\mathrm{\\alpha B}", ["46", "1246", "1", "6", "12"]],
    ["\\mathrm{123}", ["3456", "1", "12", "14"]],
    ["\\mathbf{1}x", ["3456", "1", "56", "1346"]],
    ["\\overline{x}", ["56", "1346", "45", "25", "156"]],
  ] as [string, string[]][])("%s", (input, expected) => {
    const r = convert(input);
    expect(dots(r.atoms.map((a) => a.cells).join(""))).toEqual(expected);
    expect(r.complete).toBe(true);
  });
  it("restores the default font after a structural boundary", () =>
    expect(output("\\mathit{a}+x")).toEqual([
      "56",
      "146",
      "1",
      "0",
      "235",
      "56",
      "1246",
      "1346",
    ]));
  it("retains an unsupported font style diagnosis", () =>
    expect(
      convert("\\mathsf{x}").diagnostics.some(
        (d) => d.code === "math-font-unverified",
      ),
    ).toBe(true));
  it("does not expand single-letter overline evidence to composite scope", () =>
    expect(
      convert("\\overline{xy}").diagnostics.some(
        (d) => d.code === "math-position-mark-unverified",
      ),
    ).toBe(true));
});

describe("font support boundaries", () => {
  it("does not claim that checked letter fonts cover styled Chinese", () => {
    const r = convert("\\mathbf{中国}");
    expect(r.complete).toBe(false);
    expect(r.unhandled.map((n) => n.raw).join("")).toBe("中国");
    expect(r.atoms.length).toBeGreaterThan(0);
  });
  it("does not silently approve discarded literal textit spaces", () =>
    expect(
      convert("\\textit{a b}").diagnostics.some(
        (d) => d.code === "math-font-text-unverified",
      ),
    ).toBe(true));
  it("leaves digit-only italic scope from changing the following letter font", () =>
    expect(output("\\mathit{12}a")).toEqual(["3456", "1", "12", "56", "1"]));
});

describe("review round2 styled semantic roles", () => {
  it.each([
    ["\\sin\\mathrm{\\frac{a}{b}}", "\\sin\\frac{\\mathrm{a}}{\\mathrm{b}}"],
    ["\\sin\\mathit{{\\frac{a}{b}}}", "\\sin\\frac{\\mathit{a}}{\\mathit{b}}"],
    [
      "\\sin{\\mathbf{{\\mathrm{\\frac{a}{b}}}}}",
      "\\sin\\frac{\\mathrm{a}}{\\mathrm{b}}",
    ],
    ["\\mathrm{\\log_2}\\frac{a}{b}", "\\log_2\\frac{a}{b}"],
    [
      "{\\mathrm{{\\log_2}}}{\\mathbf{{\\frac{a}{b}}}}",
      "\\log_2\\frac{\\mathbf{a}}{\\mathbf{b}}",
    ],
    [
      "\\mathit{{\\sin}}\\mathrm{{\\frac{a}{b}}}",
      "\\sin\\frac{\\mathrm{a}}{\\mathrm{b}}",
    ],
    ["\\mathrm{\\log}_2^3 x", "\\log_2^3 x"],
  ] as [string, string][])(
    "%s matches role-equivalent %s",
    (wrapped, explicit) => {
      const result = convert(wrapped);
      expect(result.complete).toBe(true);
      expect(dots(result.atoms.map((a) => a.cells).join(""))).toEqual(
        output(explicit),
      );
    },
  );
  it("keeps explicit numerator/denominator fonts as well as the function fraction frame", () =>
    expect(output("\\sin\\mathrm{\\frac{a}{b}}")).toEqual([
      "1246",
      "234",
      "23",
      "56",
      "1246",
      "1",
      "0",
      "1256",
      "56",
      "12",
      "56",
    ]));
});
