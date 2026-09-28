import { describe, it, expect } from "vitest";
import { layout } from "../packages/core/src/layout";
import { braille as b } from "../packages/core/src/rules/math-symbols";
import type { CellAtom, BrailleCellAtom } from "../packages/core/src/model";
const a = (
  cells: string,
  i = 0,
  extra: Partial<BrailleCellAtom> = {},
): BrailleCellAtom => ({
  kind: "cell",
  cells,
  span: { start: i, end: i + 1 },
  ruleId: "test",
  group: `g${i}`,
  breakBefore: false,
  breakAfter: true,
  ...extra,
});
const opts = { columns: 4, rows: 3, paragraphIndent: 0, strict: true };
describe("shared legal cell layout", () => {
  it("preserves a whole syllable and reserves next-line Chinese connector", () => {
    const r = layout(
      [
        a(b(["1", "12", "14"]), 0, {
          continuation: { lineEnd: "", lineStart: b(["36"]) },
        }),
        a(b(["145", "15"]), 1),
      ],
      opts,
    );
    expect(r.lines).toEqual([b(["1", "12", "14"]), b(["36", "145", "15"])]);
  });
  it("reserves mathematical line-end dot6", () => {
    const r = layout(
      [
        a(b(["1", "12", "14"]), 0, {
          continuation: { lineEnd: b(["6"]), lineStart: "" },
        }),
        a(b(["145", "15"]), 1),
      ],
      opts,
    );
    expect(r.lines).toEqual([b(["1", "12", "14", "6"]), b(["145", "15"])]);
  });
  it("drops only a break separator and maps that omission", () => {
    const r = layout(
      [a(b(["1", "12", "14"])), a(b(["0"]), 1), a(b(["145", "15"]), 2)],
      opts,
    );
    expect(r.lines).toEqual([b(["1", "12", "14"]), b(["145", "15"])]);
    expect(
      r.mappings.some((m: any) => m.atomIndex === 1 && m.omittedAtWrap),
    ).toBe(true);
  });
  it.each([
    ["atomic syllable", [a(b(["1", "12", "14", "145", "15"]))]],
    [
      "shared required prefix",
      [
        a(b(["4", "4"]), 0, { group: "x" }),
        a(b(["1", "12", "14"]), 1, { group: "x" }),
      ],
    ],
    [
      "no legal split",
      [
        a(b(["1", "12", "14"]), 0, { breakAfter: false }),
        a(b(["145", "15"]), 1, { breakAfter: false }),
      ],
    ],
  ] as const)("reports overflow for %s", (_name, atoms) => {
    const r = layout(atoms, opts);
    expect(r.complete).toBe(false);
    expect(r.lines).toEqual([]);
    expect(r.diagnostics[0].code).toBe("layout-overflow");
  });
  it("preserves explicit blank lines and paragraph indentation", () => {
    const br: CellAtom = {
      kind: "paragraph-break",
      span: { start: 1, end: 3 },
      ruleId: "test",
      group: "b",
      breakBefore: false,
      breakAfter: false,
    };
    expect(
      layout([a(b(["1"])), br, a(b(["12"]), 3)], {
        ...opts,
        columns: 8,
        paragraphIndent: 2,
      }).lines,
    ).toEqual([b(["0", "0", "1"]), "", b(["0", "0", "12"])]);
  });
  it.each([NaN, Infinity, -1, 0, 1.5, 1000000000])(
    "rejects invalid width %s",
    (columns) => {
      const r = layout([a(b(["1"]))], { ...opts, columns });
      expect(r.complete).toBe(false);
      expect(r.diagnostics[0].code).toBe("layout-invalid-options");
    },
  );
  it("maps atom cells to source spans and page coordinates", () => {
    const r = layout([a(b(["1", "12"]), 5)], opts);
    expect(r.mappings[0]).toMatchObject({
      atomIndex: 0,
      span: { start: 5, end: 6 },
      line: 0,
      column: 0,
      length: 2,
      page: 0,
      row: 0,
    });
  });
  it("rejects eight-dot cells and continuation markers", () => {
    expect(layout([a("\u2840")], opts).complete).toBe(false);
    expect(
      layout(
        [a(b(["1"]), 0, { continuation: { lineEnd: "x", lineStart: "" } })],
        opts,
      ).complete,
    ).toBe(false);
  });
  it("uses explicit book footer labels, row26 column30, duplex suppression", () => {
    const atoms: CellAtom[] = [];
    for (let i = 0; i < 26; i++) {
      if (i)
        atoms.push({
          kind: "line-break",
          span: { start: i, end: i },
          ruleId: "t",
          group: `br${i}`,
          breakBefore: false,
          breakAfter: false,
        });
      atoms.push(a(b(["1"]), i));
    }
    const r = layout(atoms, {
      profile: "book-body",
      paragraphIndent: 0,
      pageNumbers: {
        labels: [b(["3456", "1"]), b(["3456", "12"])],
        duplex: true,
      },
    });
    expect(r.pages).toHaveLength(2);
    expect(r.pages[0]).toHaveLength(26);
    expect(r.pages[0][25]).toBe(b(Array(28).fill("0")) + b(["3456", "1"]));
    expect(r.pages[1][25]).toBe("");
  });
  it("centers an explicitly marked heading with at least four leading cells", () => {
    const r = layout([a(b(["1", "12"]), 0, { role: "heading" } as any)], {
      ...opts,
      columns: 12,
    });
    expect(r.lines).toEqual([b(["0", "0", "0", "0", "0", "1", "12"])]);
  });
});
it("preserves explicit page breaks and maps row control without exporting its carrier cells", () => {
  const atoms: CellAtom[] = [
    a(b(["1"])),
    {
      kind: "page-break",
      span: { start: 1, end: 2 },
      group: "page",
      ruleId: "test",
      breakAfter: false,
      breakBefore: false,
    },
    a(b(["12"]), 2),
  ];
  const r = layout(atoms, opts);
  expect(r.pages).toEqual([[b(["1"])], [b(["12"])]]);
  expect(r.mappings.find((m: any) => m.atomIndex === 2)?.page).toBe(1);
});
it("retains a meaningful two-cell space at a wrap and validates hostile controls", () => {
  const r = layout(
    [
      a(b(["1", "12"])),
      a(b(["0", "0"]), 1, { preserveSpace: true }),
      a(b(["14", "145"]), 2),
    ],
    opts,
  );
  expect(r.lines.join("")).toContain(b(["0", "0"]));
  for (const count of [NaN, Infinity, -1, 1e9])
    expect(
      layout(
        [
          {
            kind: "paragraph-break",
            count,
            span: { start: 0, end: 1 },
            group: "b",
            ruleId: "t",
            breakAfter: false,
            breakBefore: false,
          },
        ],
        opts,
      ).complete,
    ).toBe(false);
});
it("labels editorial indent mappings and rejects row controls splitting a shared group", () => {
  const r = layout([a(b(["1"]))], { ...opts, paragraphIndent: 2 });
  expect(r.mappings[0].kind).toBe("indent");
  const invalid = layout(
    [
      a(b(["1"]), 0, { group: "shared" }),
      a(b(["12"]), 1, { group: "shared", rowStart: true }),
    ],
    opts,
  );
  expect(invalid.complete).toBe(false);
  expect(
    invalid.diagnostics.some(
      (d: any) => d.code === "layout-conflicting-control",
    ),
  ).toBe(true);
});
it("maps initial paragraph indentation as indent even when that paragraph wraps", () => {
  const r = layout([a(b(["1", "12"]), 0), a(b(["14", "145"]), 1)], {
    ...opts,
    columns: 4,
    paragraphIndent: 2,
  });
  expect(r.lines).toHaveLength(2);
  expect(
    r.mappings.find((m: any) => m.line === 0 && m.atomIndex === null)?.kind,
  ).toBe("indent");
});
