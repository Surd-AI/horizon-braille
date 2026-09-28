import { it, expect } from "vitest";
import fixtures from "./standards/layout.json";
import { convert } from "../packages/core/src/convert";
import { layout } from "../packages/core/src/layout";
import { encodeMath } from "../packages/core/src/rules/math";
import { parseMath } from "../packages/core/src/parser/math";
import { braille as b } from "../packages/core/src/rules/math-symbols";
import type { CellAtom, BrailleCellAtom } from "../packages/core/src/model";
const a = (
  dots: string[],
  i = 0,
  extra: Partial<BrailleCellAtom> = {},
): BrailleCellAtom => ({
  kind: "cell",
  cells: b(dots),
  span: { start: i, end: i + 1 },
  group: `g${i}`,
  ruleId: "fixture",
  breakBefore: false,
  breakAfter: true,
  ...extra,
});
it.each(fixtures)("independent focused $id: $note", (f) => {
  const opts = { paragraphIndent: 0, columns: 100 };
  if (["layout-L03", "layout-L04", "layout-L05"].includes(f.id)) {
    expect(
      encodeMath(parseMath(f.input))
        .atoms.map((a) => a.cells)
        .join(""),
    ).toBe(b(f.expectedDots));
    return;
  }
  if (f.id === "layout-L06") {
    expect(convert(f.input, opts).unicode).toBe(
      b(["1345", "0", "46", "456", "125", "23", "135", "156", "0", "1345"]),
    );
    return;
  }
  if (f.id === "layout-L07" || f.id === "layout-L08" || f.id === "layout-L09") {
    const atoms = [
      a(["1", "12", "14"], 0, {
        continuation: {
          lineEnd: f.id === "layout-L07" ? b(["6"]) : "",
          lineStart: f.id === "layout-L09" ? b(["36"]) : "",
        },
      }),
      ...(f.id === "layout-L08" ? [a(["0"], 1)] : []),
      a(["145", "15"], 2),
    ];
    const r = layout(atoms, { columns: 4, paragraphIndent: 0 });
    expect(r.lines[f.id === "layout-L09" ? 1 : 0]).toBe(b(f.expectedDots));
    return;
  }
  if (f.id === "layout-L10") {
    expect(
      convert("你\n\n你", { columns: 20, paragraphIndent: 3 }).lines,
    ).toEqual([b(["0", "0", "0", "1345"]), "", b(["0", "0", "0", "1345"])]);
    return;
  }
  if (f.id === "layout-L15") {
    const atoms: CellAtom[] = [];
    for (let i = 0; i < 26; i++) {
      if (i)
        atoms.push({
          kind: "line-break",
          span: { start: i, end: i },
          ruleId: "fixture",
          group: `br${i}`,
          breakBefore: false,
          breakAfter: false,
        });
      atoms.push(a(["1"], i));
    }
    const r = layout(atoms, {
      profile: "book-body",
      paragraphIndent: 0,
      pageNumbers: { labels: [b(["3456", "1"])], duplex: true },
    });
    expect(r.pages[0][25]).toBe(b(Array(28).fill("0")) + b(["3456", "1"]));
    expect(r.pages[1][25]).toBe("");
    return;
  }
  expect(convert(f.input, opts).unicode).toBe(b(f.expectedDots));
  if (f.id === "layout-L14")
    expect(
      convert(f.input, { columns: 3, paragraphIndent: 0 }).diagnostics.some(
        (d) => d.code === "layout-overflow",
      ),
    ).toBe(true);
});
