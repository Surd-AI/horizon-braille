import { expect, test } from "vitest";
import { parseDocument } from "../packages/core/src/parser/document";
import { parseMath } from "../packages/core/src/parser/math";
import {
  encodeDocument,
  reflowExistingAtoms,
} from "../packages/core/src/convert";
import {
  resolveAmbiguities,
  convertWithResolutions,
} from "../packages/core/src/ambiguity";

test.each([
  [String.raw`前\frac{1}{2}+\sqrt{3}后`, String.raw`\frac{1}{2}+\sqrt{3}`],
  ["前x^2+1后", "x^2+1"],
  ["a+b=c", "a+b=c"],
  ["x=1", "x=1"],
  [String.raw`前\sin x后`, String.raw`\sin x`],
  [String.raw`前\alpha^2后`, String.raw`\alpha^2`],
  [
    String.raw`前\begin{matrix}1&2\\3&4\end{matrix}后`,
    String.raw`\begin{matrix}1&2\\3&4\end{matrix}`,
  ],
])(
  "recognizes complete bare islands with exact original spans: %s",
  (source, formula) => {
    const doc = parseDocument(source);
    expect(
      doc.nodes.filter((n) => n.kind === "bare-math").map((n) => n.raw),
    ).toEqual([formula]);
    expect(doc.nodes.map((n) => n.raw).join("")).toBe(source);
  },
);
test.each([
  "foo_bar",
  "ordinary English 123",
  "a+b",
  String.raw`C:\frac{1}{2}`,
  "C:/x=1",
  String.raw`\\server\frac{1}{2}`,
  String.raw`\\frac{1}{2}`,
])("never guesses code/path/weak inputs: %s", (source) => {
  expect(
    parseDocument(source).nodes.some(
      (n) => n.kind === "bare-math" || n.kind === "chemistry",
    ),
  ).toBe(false);
});
test("chemical domains separate from adjacent clock prose", async () => {
  const source = String.raw`会议12:30，反应\ce{H2}结束`;
  expect(parseDocument(source).nodes.map((n) => n.kind)).toEqual([
    "text",
    "chemistry",
    "text",
  ]);
  const decisions = await resolveAmbiguities(source);
  const r = convertWithResolutions(source, decisions, {
    timePolicy: "normalize-hours-minutes",
  });
  expect(
    r.diagnostics.some((d) => d.code === "ambiguity-time-scope-unsupported"),
  ).toBe(false);
  expect(
    r.diagnostics.some((d) => d.code === "ambiguity-time-normalized"),
  ).toBe(true);
  expect(r.document.source).toBe(source);
});
test("merges unscripted Han only after binding TeX single-token scripts", () => {
  expect(parseMath("重量").body).toMatchObject({
    children: [{ kind: "text", value: "重量" }],
  });
  expect(parseMath("x^中文").body).toMatchObject({
    children: [
      { kind: "script", sup: { value: "中" } },
      { kind: "text", value: "文" },
    ],
  });
  expect(parseMath("中文^2").body).toMatchObject({
    children: [
      { kind: "text", value: "中" },
      { kind: "script", base: { value: "文" } },
    ],
  });
  const r = encodeDocument("$重量$", {
    overrides: [{ start: 1, end: 3, readings: ["chong2", "liang4"] }],
  });
  expect(r.diagnostics.some((d) => d.code === "CHINESE_INVALID_OVERRIDE")).toBe(
    false,
  );
  expect(
    r.metadata.chineseWords
      .filter((w) => w.kind === "chinese")
      .map((w) => w.raw),
  ).toEqual(["重量"]);
  expect(reflowExistingAtoms(r, { columns: 40 }).metadata).toBe(r.metadata);
});
test.each([
  "$bad\n\n后文$x$",
  "$$bad\r\n\r\n后文",
  String.raw`\frac{broken` + "\n\n后文",
  String.raw`\ce{broken` + "\n\n后文",
])("recovers malformed formula before later paragraphs: %s", (source) => {
  const doc = parseDocument(source);
  expect(
    doc.nodes.some((n) => n.kind === "text" && n.raw.includes("后文")),
  ).toBe(true);
  expect(doc.nodes.map((n) => n.raw).join("")).toBe(source);
  expect(doc.diagnostics.length).toBeGreaterThan(0);
});
test("unknown command is exact and leaves following known formula and prose", () => {
  const doc = parseDocument(String.raw`前\fraction\sqrt{2}后`);
  expect(doc.diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "bare-unknown-command",
        span: { start: 1, end: 10 },
      }),
    ]),
  );
  expect(doc.nodes.at(-1)).toMatchObject({ kind: "text", raw: "后" });
  expect(
    doc.nodes.some(
      (n) => n.kind === "bare-math" && n.raw === String.raw`\sqrt{2}`,
    ),
  ).toBe(true);
});

const delimiters = [
  ["$", "$", "inline-math"],
  ["$$", "$$", "display-math"],
  [String.raw`\(`, String.raw`\)`, "inline-math"],
  [String.raw`\[`, String.raw`\]`, "display-math"],
] as const;
for (const [open, close, kind] of delimiters) {
  test.each(["x", "", "x\ny", "x\r\ny"])(
    `preserves ${open} explicit payload %j`,
    (content) => {
      const source = `前${open}${content}${close}后`;
      const doc = parseDocument(source);
      if (open === "$" && content === "") {
        // The existing longest opener wins: $$ means display, never empty inline.
        expect(doc.nodes[1]).toMatchObject({
          kind: "display-math",
          closed: false,
          raw: "$$后",
        });
        expect(doc.diagnostics.some((d) => d.code === "unclosed-math")).toBe(
          true,
        );
        return;
      }
      expect(doc.nodes).toMatchObject([
        { kind: "text", raw: "前" },
        { kind, content, closed: true },
        { kind: "text", raw: "后" },
      ]);
      expect(doc.nodes[1].span).toEqual({
        start: 1,
        end: 1 + open.length + content.length + close.length,
      });
      expect(doc.nodes.map((n) => n.raw).join("")).toBe(source);
    },
  );
  test(`adjacent and malformed ${open} recover domains`, () => {
    const a = parseDocument(`${open}x${close}${open}y${close}`);
    expect(a.nodes.map((n) => n.kind)).toEqual([kind, kind]);
    const source = `${open}bad\n\n后${open}x${close}`;
    const b = parseDocument(source);
    expect(b.nodes).toMatchObject([
      { kind, closed: false },
      { kind: "paragraph-break" },
      { kind: "text", raw: "后" },
      { kind, closed: true, content: "x" },
    ]);
    expect(b.nodes.map((n) => n.raw).join("")).toBe(source);
  });
}

test("ordinary grouping cannot hide explicit math priority", () => {
  const doc = parseDocument("普通(hello $x$)和{x $y$}");
  expect(
    doc.nodes.flatMap((n) => (n.kind === "inline-math" ? [n.content] : [])),
  ).toEqual(["x", "y"]);
});
test.each(["a+b", String.raw`\times`, String.raw`x^中文`])(
  "uncertain bare syntax is visible rather than silently chosen: %s",
  (source) => {
    expect(
      parseDocument(source).diagnostics.some((d) => d.code.startsWith("bare-")),
    ).toBe(true);
  },
);
test("ambiguous dollar currency is diagnosed without changing explicit delimiter priority", () => {
  const source = "$5 and $10";
  const doc = parseDocument(source);
  expect(doc.nodes[0]).toMatchObject({
    kind: "inline-math",
    content: "5 and ",
    closed: true,
  });
  expect(
    doc.diagnostics.some((d) => d.code === "ambiguous-dollar-number"),
  ).toBe(true);
});
test("Greek structured operands route together while ordinary following English survives", () => {
  const doc = parseDocument(String.raw`\alpha+\beta trailing prose`);
  expect(doc.nodes).toMatchObject([
    { kind: "bare-math", raw: String.raw`\alpha+\beta` },
    { kind: "text", raw: " trailing prose" },
  ]);
});
test("large unscripted Han run merges within a linear processing budget", () => {
  const text = "中".repeat(70000);
  const started = performance.now();
  expect(parseMath(text).body).toMatchObject({
    children: [{ kind: "text", value: text, span: { start: 0, end: 70000 } }],
  });
  expect(performance.now() - started).toBeLessThan(1500);
});

test.each([
  String.raw`\frac12`,
  String.raw`\sqrt x`,
  String.raw`\sin^2 x`,
  String.raw`x\leq 1`,
  String.raw`\mathbf{x}+1`,
  String.raw`\hat{x}=1`,
  String.raw`\sqrt{\text{(}}`,
])("recognizes legal command operands without rewriting TeX: %s", (formula) => {
  expect(parseDocument(`前${formula}后`).nodes).toMatchObject([
    { kind: "text", raw: "前" },
    { kind: "bare-math", raw: formula },
    { kind: "text", raw: "后" },
  ]);
});
test.each(["(ordinary English)=1", "[hello $x$]=1"])(
  "ordinary grouped text cannot create a formula island: %s",
  (source) => {
    expect(
      parseDocument(source).nodes.some((n) => n.kind === "bare-math"),
    ).toBe(false);
  },
);
test("nested braced and text arguments retain their exact tail and complete source", () => {
  const source = String.raw`😀前\frac{\sqrt{3}}{\text{重量 with spaces}}后\ce{H2}尾`;
  const doc = parseDocument(source);
  expect(doc.nodes.map((n) => n.kind)).toEqual([
    "text",
    "bare-math",
    "text",
    "chemistry",
    "text",
  ]);
  let end = 0;
  for (const n of doc.nodes) {
    expect(n.span.start).toBe(end);
    expect(source.slice(n.span.start, n.span.end)).toBe(n.raw);
    end = n.span.end;
  }
  expect(end).toBe(source.length);
});
test("literal escaped braces and line breaks within complete chemical arguments survive", () => {
  const formula = String.raw`\ce{C ->[\text{重量}] O}`;
  const doc = parseDocument(`前${formula}后`);
  expect(doc.nodes[1]).toMatchObject({ kind: "chemistry", raw: formula });
  expect(parseDocument(String.raw`\ce{H2 \{ O\}}尾`).nodes[0]).toMatchObject({
    kind: "chemistry",
    raw: String.raw`\ce{H2 \{ O\}}`,
  });
  expect(parseDocument("前\\frac{1\n+2}{3}后").nodes[1]).toMatchObject({
    kind: "bare-math",
    raw: "\\frac{1\n+2}{3}",
  });
});
test("Han runs do not merge across spaces, wrappers, groups or script boundaries", () => {
  expect(parseMath("中 文").body).toMatchObject({
    children: [
      { kind: "text", value: "中" },
      { kind: "text", value: "文" },
    ],
  });
  expect(parseMath(String.raw`中\text{文}`).body).toMatchObject({
    children: [
      { kind: "text", value: "中" },
      { kind: "text", value: "文" },
    ],
  });
  expect(parseMath("中{文}").body).toMatchObject({
    children: [{ kind: "text", value: "中" }, { kind: "group" }],
  });
  const r = encodeDocument("$中文^2$", {
    overrides: [{ start: 1, end: 3, readings: ["zhong1", "wen2"] }],
  });
  expect(r.diagnostics.some((d) => d.code === "CHINESE_INVALID_OVERRIDE")).toBe(
    true,
  );
  expect(r.metadata.chineseWords.some((w) => w.source === "manual")).toBe(
    false,
  );
});
test.each([
  "$重量$",
  String.raw`$\text{重量 with spaces}$`,
  String.raw`$\mbox{重量}$`,
])("manual word joins and splits in formula text: %s", (source) => {
  const start = source.indexOf("重");
  const joined = encodeDocument(source, {
    overrides: [{ start, end: start + 2, readings: ["chong2", "liang4"] }],
  });
  expect(
    joined.metadata.chineseWords
      .find((w) => w.raw === "重量")
      ?.syllables.map((s) => s.reading),
  ).toEqual(["chong2", "liang4"]);
  expect(
    joined.diagnostics.some((d) => d.code === "CHINESE_INVALID_OVERRIDE"),
  ).toBe(false);
  const split = encodeDocument(source, {
    overrides: [
      { start, end: start + 1, readings: ["chong2"] },
      { start: start + 1, end: start + 2, readings: ["liang4"] },
    ],
  });
  expect(
    split.metadata.chineseWords
      .filter((w) => w.kind === "chinese")
      .map((w) => w.raw),
  ).toEqual(["重", "量"]);
  expect(
    split.metadata.chineseWords
      .filter((w) => w.kind === "chinese")
      .map((w) => w.span),
  ).toEqual([
    { start, end: start + 1 },
    { start: start + 1, end: start + 2 },
  ]);
});

import { braille as b } from "../packages/core/src/rules/math-symbols";
test.each([
  String.raw`\frac{13}{28}`,
  String.raw`$\frac{13}{28}$`,
  String.raw`$$\frac{13}{28}$$`,
  String.raw`\(\frac{13}{28}\)`,
  String.raw`\[\frac{13}{28}\]`,
])(
  "routes all formula origins through the independently checked numeric fraction rule: %s",
  (source) => {
    const r = reflowExistingAtoms(encodeDocument(source), {
      columns: 100,
      paragraphIndent: 0,
    });
    // GB/T18028 §6.4 fixture gb18028-math-2, independently visually checked table.
    expect(r.unicode).toBe(b(["3456", "1", "14", "23", "236"]));
    expect(r.complete).toBe(true);
    for (const m of r.mappings) {
      expect(m.span.start).toBeGreaterThanOrEqual(0);
      expect(m.span.end).toBeLessThanOrEqual(source.length);
    }
  },
);
test("bare mathematical and chemical islands have distinct prose framing and exact tail mappings", () => {
  const source = String.raw`你\frac{13}{28}你\ce{H2}你`;
  const r = reflowExistingAtoms(encodeDocument(source), {
    columns: 100,
    paragraphIndent: 0,
  });
  expect(r.unicode).toContain(
    b(["0", "46", "3456", "1", "14", "23", "236", "0"]),
  );
  expect(r.unicode).toContain(b(["156", "0"]));
  expect(r.unicode.match(new RegExp(b(["156"]), "g"))).toHaveLength(1);
  const tail = r.mappings.filter((m) => m.span.start === source.length - 1);
  expect(
    tail.some(
      (m) => source.slice(m.span.start, m.span.end) === "你" && m.length > 0,
    ),
  ).toBe(true);
  expect(parseDocument("C").nodes).toMatchObject([{ kind: "text", raw: "C" }]);
});
test("pure chemical and math-wrapped chemistry preserve distinct whole-formula framing", () => {
  for (const [open, close] of delimiters) {
    const source = `你${open}\\ce{H2}${close}你`;
    const r = encodeDocument(source);
    const cells = r.atoms
      .filter((a) => a.kind === "cell")
      .map((a) => a.cells)
      .join("");
    if (open === "$" || open === String.raw`\(`)
      expect(cells).toContain(b(["156", "0"]));
    expect(r.document.source).toBe(source);
  }
  expect(
    encodeDocument(String.raw`\ce{H2}`)
      .atoms.filter((a) => a.kind === "cell")
      .map((a) => a.cells)
      .join(""),
  ).not.toContain(b(["156"]));
});
test("supplementary Han maintains whole scalar override and source offsets", () => {
  const source = "$𠀀中$";
  const r = encodeDocument(source, {
    overrides: [{ start: 1, end: 4, readings: ["he1", "zhong1"] }],
  });
  expect(
    r.metadata.chineseWords
      .filter((w) => w.kind === "chinese")
      .map((w) => w.span),
  ).toEqual([{ start: 1, end: 4 }]);
  expect(
    r.metadata.chineseWords.flatMap((w) => w.syllables).map((s) => s.span),
  ).toEqual([
    { start: 1, end: 3 },
    { start: 3, end: 4 },
  ]);
});
test("bounded malformed openers preserve all paragraphs and do not repeatedly scan to EOF", () => {
  const source = (String.raw`\frac{\bad ` + "\n\n").repeat(2000) + "结束";
  const started = performance.now();
  const doc = parseDocument(source);
  expect(doc.nodes.map((n) => n.raw).join("")).toBe(source);
  expect(doc.nodes.at(-1)).toMatchObject({ kind: "text", raw: "结束" });
  expect(doc.diagnostics.length).toBeGreaterThanOrEqual(2000);
  expect(performance.now() - started).toBeLessThan(1500);
  const deep = encodeDocument(
    String.raw`\frac{` + "{".repeat(100) + "1" + "}".repeat(100) + "}{2}后",
  );
  expect(deep.diagnostics.some((d) => d.code === "math-depth-limit")).toBe(
    true,
  );
  expect(deep.document.nodes.at(-1)).toMatchObject({ kind: "text", raw: "后" });
});
test.each([
  String.raw`\begin{unknown}a\end{unknown}后`,
  String.raw`\begin{matrix}a` + "\n\n后",
])(
  "unsupported or incomplete environments retain later prose: %s",
  (source) => {
    const r = encodeDocument(source);
    expect(r.document.nodes.map((n) => n.raw).join("")).toBe(source);
    expect(
      r.diagnostics.some((d) => d.code === "bare-incomplete-formula"),
    ).toBe(true);
    expect(r.document.nodes.at(-1)?.raw).toContain("后");
    expect(r.complete).toBe(false);
  },
);

test("escaped character scanning cannot cross the paragraph recovery boundary", () => {
  const source = "$x\\\n\n后";
  const doc = parseDocument(source);
  expect(doc.nodes).toMatchObject([
    { kind: "inline-math", raw: "$x\\", closed: false },
    { kind: "paragraph-break", raw: "\n\n" },
    { kind: "text", raw: "后" },
  ]);
});

test("trailing incomplete operator is diagnosed without absorbing ordinary tail text", () => {
  const source = String.raw`\frac{1}{2}+ordinary prose后`;
  const doc = parseDocument(source);
  expect(doc.nodes[0]).toMatchObject({
    kind: "bare-math",
    raw: String.raw`\frac{1}{2}`,
  });
  expect(doc.nodes.at(-1)).toMatchObject({
    kind: "text",
    raw: "+ordinary prose后",
  });
  expect(
    doc.diagnostics.some((d) => d.code === "bare-incomplete-expression"),
  ).toBe(true);
});

test("explicit math mode resolves intentionally weak auto-recognition without stale document warnings", () => {
  const auto = encodeDocument("a+b");
  expect(
    auto.diagnostics.some((d) => d.code === "bare-ambiguous-formula"),
  ).toBe(true);
  expect(auto.complete).toBe(false);
  expect(
    auto.atoms
      .filter((a) => a.kind === "cell")
      .map((a) => a.cells)
      .join(""),
  ).toBe(b(["56", "1", "0", "46", "235", "0", "56", "12"]));
  expect(
    auto.document.diagnostics.find((d) => d.code === "bare-ambiguous-formula")
      ?.span,
  ).toEqual({ start: 0, end: 3 });
  expect(encodeDocument(auto.document, { mode: "math" }).complete).toBe(true);
  const explicit = encodeDocument("a+b", { mode: "math" });
  expect(explicit.complete).toBe(true);
  expect(explicit.diagnostics.some((d) => d.code.startsWith("bare-"))).toBe(
    false,
  );
});

test("bare brace-wrapped English is not mistaken for a mathematical relation", () => {
  expect(
    parseDocument("{hello}=1").nodes.some((n) => n.kind === "bare-math"),
  ).toBe(false);
  expect(parseDocument("x^{中文}").nodes[0]).toMatchObject({
    kind: "bare-math",
    raw: "x^{中文}",
  });
});

test.each([
  String.raw`\alpha`,
  String.raw`前\alpha后`,
  String.raw`\alpha\beta`,
])("review: complete known Greek commands are math domains: %s", (source) => {
  const r = encodeDocument(source);
  const formulas = r.document.nodes.filter((n) => n.kind === "bare-math");
  expect(formulas.map((n) => n.raw)).toEqual([
    source.startsWith("前") ? String.raw`\alpha` : source,
  ]);
  expect(
    r.diagnostics.some(
      (d) => d.code.startsWith("bare-") || d.code === "text-unhandled",
    ),
  ).toBe(false);
  expect(
    formulas.every((n) => source.slice(n.span.start, n.span.end) === n.raw),
  ).toBe(true);
  // Independently checked fixture gb18028-math-7, Greek prefix then alpha/beta.
  if (source === String.raw`\alpha\beta`)
    expect(
      r.atoms.map((a) => (a.kind === "cell" ? a.cells : "")).join(""),
    ).toBe(b(["46", "1", "12"]));
});
test.each([
  "2x^2",
  "(x)2\\alpha",
  String.raw`\frac{1}{2}x`,
  "x^2y",
  String.raw`\frac{1}{2}3`,
  "x^2(y+1)",
  String.raw`x^2\alpha`,
  String.raw`2\alpha`,
  String.raw`\alpha2`,
  String.raw`\frac{1}{2}(x+1)\beta`,
])(
  "review: adjacent mathematical atoms remain one whole formula without prose framing: %s",
  (source) => {
    const r = encodeDocument(source);
    expect(r.document.nodes).toMatchObject([
      { kind: "bare-math", raw: source },
    ]);
    expect(r.complete).toBe(true);
    expect(
      r.atoms.map((a) => (a.kind === "cell" ? a.cells : "")).join(""),
    ).toBe(
      encodeDocument(source, { mode: "math" })
        .atoms.map((a) => (a.kind === "cell" ? a.cells : ""))
        .join(""),
    );
  },
);
test.each([String.raw`\frac{1}{2}hello`, "x^2hello"])(
  "review: adjacent ordinary English survives with boundary uncertainty: %s",
  (source) => {
    const r = encodeDocument(source);
    expect(r.document.nodes.at(-1)).toMatchObject({
      kind: "text",
      raw: "hello",
    });
    expect(r.document.nodes.map((n) => n.raw).join("")).toBe(source);
    expect(
      r.diagnostics.some((d) => d.code === "bare-ambiguous-boundary"),
    ).toBe(true);
    expect(r.complete).toBe(false);
  },
);
test.each([String.raw`\frac{1}{2}x后`, "x^2y后", String.raw`\alpha hello`])(
  "review: safe Chinese and separated ordinary English tails survive: %s",
  (source) => {
    const r = encodeDocument(source);
    expect(r.document.nodes.at(-1)).toMatchObject({
      kind: "text",
      raw: source.endsWith("后") ? "后" : " hello",
    });
    expect(r.document.nodes.map((n) => n.raw).join("")).toBe(source);
    expect(r.diagnostics.some((d) => d.code.startsWith("bare-"))).toBe(false);
  },
);
test.each(["x=", "x=hello", "x<hello", String.raw`x\leq hello`])(
  "review: missing relation operands never report complete conversion: %s",
  (source) => {
    const r = encodeDocument(source);
    expect(r.complete).toBe(false);
    expect(
      r.diagnostics.some(
        (d) =>
          d.code === "bare-incomplete-expression" ||
          d.code === "bare-ambiguous-formula",
      ),
    ).toBe(true);
    expect(r.document.nodes.map((n) => n.raw).join("")).toBe(source);
    if (source.endsWith("hello"))
      expect(r.document.nodes.at(-1)?.raw).toContain("hello");
    const diagnostic = r.diagnostics.find((d) => d.code.startsWith("bare-"))!;
    expect(diagnostic.span.end).toBeGreaterThan(1);
  },
);

test("review: weak adjacent groups do not repeatedly rescan the remaining source", () => {
  const source = "(x)".repeat(6000);
  const started = performance.now();
  const doc = parseDocument(source);
  expect(doc.nodes.map((n) => n.raw).join("")).toBe(source);
  expect(doc.nodes.some((n) => n.kind === "bare-math")).toBe(false);
  expect(performance.now() - started).toBeLessThan(1500);
});

test.each([
  "(x=1)",
  String.raw`(\frac{1}{2})`,
  String.raw`(\alpha)`,
  String.raw`[({\alpha})]`,
  "((x^2))",
])(
  "review2: complete group propagates internal mathematical evidence: %s",
  (formula) => {
    for (const source of [formula, `前${formula}后`]) {
      const r = encodeDocument(source);
      expect(
        r.document.nodes
          .filter((n) => n.kind === "bare-math")
          .map((n) => n.raw),
      ).toEqual([formula]);
      expect(r.document.nodes.map((n) => n.raw).join("")).toBe(source);
      expect(
        r.diagnostics.some(
          (d) => d.code.startsWith("bare-") || d.code === "text-unhandled",
        ),
      ).toBe(false);
      if (source === formula) expect(r.complete).toBe(true);
    }
  },
);
test.each(["(x=)", "(x+1)", String.raw`(\alpha hello)`])(
  "review2: uncertain grouped mathematics remains visible and incomplete: %s",
  (source) => {
    const r = encodeDocument(source);
    expect(r.document.nodes.map((n) => n.raw).join("")).toBe(source);
    expect(r.diagnostics.some((d) => d.code.startsWith("bare-"))).toBe(true);
    expect(r.complete).toBe(false);
  },
);
test.each([
  String.raw`\infty`,
  String.raw`\emptyset`,
  String.raw`\varnothing`,
  String.raw`\aleph`,
  "∞",
  "∅",
])(
  "review2: existing independently encodable constants are complete operands: %s",
  (formula) => {
    for (const source of [formula, `前${formula}后`]) {
      const r = encodeDocument(source);
      expect(
        r.document.nodes
          .filter((n) => n.kind === "bare-math")
          .map((n) => n.raw),
      ).toEqual([formula]);
      expect(
        r.diagnostics.some(
          (d) => d.code.startsWith("bare-") || d.code === "text-unhandled",
        ),
      ).toBe(false);
      if (source === formula) expect(r.complete).toBe(true);
    }
  },
);
test.each([
  String.raw`x=\infty`,
  String.raw`x^2\infty`,
  String.raw`(\emptyset)`,
  String.raw`\aleph_0`,
])(
  "review2: constant is operand rather than an infix operator: %s",
  (source) => {
    const r = encodeDocument(source);
    expect(r.document.nodes).toMatchObject([
      { kind: "bare-math", raw: source },
    ]);
    expect(r.complete).toBe(true);
  },
);
test.each([
  String.raw`\times`,
  String.raw`\leq`,
  String.raw`\sum`,
  String.raw`\circ`,
])(
  "review2: operator or modifier without required context remains diagnostic: %s",
  (source) => {
    const r = encodeDocument(source);
    expect(r.diagnostics.some((d) => d.code.startsWith("bare-"))).toBe(true);
    expect(r.complete).toBe(false);
  },
);

test.each([String.raw`(x\leq 1)`, "(x+1)=2", String.raw`(x=\infty)`])(
  "review2: outer and inner relation evidence resolves otherwise weak groups: %s",
  (source) => {
    const r = encodeDocument(source);
    expect(r.document.nodes).toMatchObject([
      { kind: "bare-math", raw: source },
    ]);
    expect(r.complete).toBe(true);
  },
);
test("review2: infinity uses the checked numeral constant cells without an unhandled placeholder", () => {
  const r = encodeDocument(String.raw`\infty`);
  // Existing GB/T18028 §5.1 symbol rule, not a snapshot of this parser.
  expect(r.atoms.map((a) => (a.kind === "cell" ? a.cells : "")).join("")).toBe(
    b(["3456", "123456"]),
  );
  expect(r.unhandled).toEqual([]);
  expect(r.complete).toBe(true);
});

for (const [open, close, kind] of delimiters) {
  test.each([
    String.raw`\alpha hello`,
    "x=hello",
    String.raw`\unknown hello`,
    String.raw`\times hello`,
  ])(
    `review3: invalid group prefix preserves later ${open} formula after %s`,
    (prefix) => {
      const source = `前(${prefix} ${open}y${close})后`;
      const doc = parseDocument(source);
      expect(
        doc.nodes.filter((n) => n.kind === kind).map((n) => n.raw),
      ).toEqual([`${open}y${close}`]);
      expect(doc.nodes.map((n) => n.raw).join("")).toBe(source);
      expect(doc.nodes.at(-1)?.raw).toContain("后");
    },
  );
}
test("review3: invalid nested group recovery resumes known local bare formulas too", () => {
  const source = String.raw`前((\alpha hello \sqrt{2}) text $x$)后`;
  const doc = parseDocument(source);
  expect(
    doc.nodes.filter((n) => n.kind === "bare-math").map((n) => n.raw),
  ).toEqual([String.raw`\alpha`, String.raw`\sqrt{2}`]);
  expect(
    doc.nodes.filter((n) => n.kind === "inline-math").map((n) => n.raw),
  ).toEqual(["$x$"]);
  expect(doc.nodes.map((n) => n.raw).join("")).toBe(source);
});
test("review3: invalid group recovery respects escaped dollar and backslash opener parity", () => {
  const source = String.raw`(\alpha hello \$x \(y\) \\(z) $q$)`;
  const doc = parseDocument(source);
  expect(
    doc.nodes.filter((n) => n.kind === "inline-math").map((n) => n.raw),
  ).toEqual([String.raw`\(y\)`, "$q$"]);
  expect(doc.nodes.map((n) => n.raw).join("")).toBe(source);
});
test.each([
  String.raw`\frac{\text{hello $x$}}{2}`,
  String.raw`\ce{C ->[\text{hello $x$}] O}`,
])(
  "review3: balanced structural arguments keep their literal delimiters: %s",
  (source) => {
    const doc = parseDocument(source);
    expect(doc.nodes).toHaveLength(1);
    expect(doc.nodes[0]).toMatchObject({
      kind: source.startsWith(String.raw`\ce`) ? "chemistry" : "bare-math",
      raw: source,
    });
    expect(doc.diagnostics).toEqual([]);
  },
);

test("review3: nested invalid outer groups with long weak prefixes remain bounded and recover local formulas", () => {
  const source =
    "(".repeat(16) +
    "(x)".repeat(3000) +
    String.raw` x=hello \sqrt{2} $y$` +
    ")".repeat(16);
  const started = performance.now();
  const doc = parseDocument(source);
  expect(
    doc.nodes.filter((n) => n.kind === "bare-math").map((n) => n.raw),
  ).toContain(String.raw`\sqrt{2}`);
  expect(
    doc.nodes.filter((n) => n.kind === "inline-math").map((n) => n.raw),
  ).toEqual(["$y$"]);
  expect(doc.nodes.map((n) => n.raw).join("")).toBe(source);
  expect(performance.now() - started).toBeLessThan(1500);
});
