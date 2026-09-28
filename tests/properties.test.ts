import { it, expect } from "vitest";
import fc from "fast-check";
import {
  convert,
  encodeDocument,
  reflowExistingAtoms,
} from "../packages/core/src/convert";
import { layout } from "../packages/core/src/layout";
import { unicodeToBrf, brfToUnicode } from "../packages/core/src/codec";
import type { BrailleCellAtom } from "../packages/core/src/model";
const config = { seed: 20260924, numRuns: 250 };
it("generated six-dot carrier strings roundtrip exactly", () => {
  fc.assert(
    fc.property(
      fc.array(fc.integer({ min: 0, max: 63 }), { maxLength: 1000 }),
      (masks) => {
        const value = masks
          .map((m) => String.fromCharCode(0x2800 + m))
          .join("");
        expect(brfToUnicode(unicodeToBrf(value))).toBe(value);
      },
    ),
    config,
  );
});
it("generated atomic layout preserves every nonblank atom or explicitly fails with no export", () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.array(fc.integer({ min: 1, max: 63 }), {
          minLength: 1,
          maxLength: 8,
        }),
        { maxLength: 60 },
      ),
      fc.integer({ min: 1, max: 40 }),
      (groups, columns) => {
        const atoms: BrailleCellAtom[] = groups.map((g, i) => ({
          kind: "cell",
          cells: g.map((m) => String.fromCharCode(0x2800 + m)).join(""),
          span: { start: i * 2, end: i * 2 + 1 },
          ruleId: "generated",
          group: `g${i}`,
          breakBefore: false,
          breakAfter: true,
        }));
        const before = JSON.stringify(atoms),
          r = layout(atoms, { columns, rows: 7, paragraphIndent: 0 });
        expect(JSON.stringify(atoms)).toBe(before);
        if (r.complete) {
          expect(r.lines.every((line) => line.length <= columns)).toBe(true);
          expect(r.lines.join("")).toBe(atoms.map((a) => a.cells).join(""));
          expect(
            r.mappings
              .filter((m) => m.atomIndex !== null)
              .map((m) => m.atomIndex),
          ).toEqual(atoms.map((_, i) => i));
          for (const m of r.mappings)
            if (m.atomIndex !== null) {
              expect(
                r.pages[m.page][m.row].slice(m.column, m.column + m.length),
              ).toBe(atoms[m.atomIndex].cells);
              expect(m.span).toEqual(atoms[m.atomIndex].span);
            }
        } else {
          expect(r.lines).toEqual([]);
          expect(r.diagnostics.some((d) => d.code === "layout-overflow")).toBe(
            true,
          );
        }
      },
    ),
    config,
  );
});
it("random mixed source is retained, bounded, deterministic and mapped in UTF16 coordinates", () => {
  const token = fc.constantFrom(
    "你",
    "好",
    "重量",
    "27",
    "abc",
    "😀",
    "\\$",
    "$x+2$",
    "\\ce{H2O}",
    "\n",
    "\n\n",
    "，",
    "　",
    " ",
  );
  fc.assert(
    fc.property(
      fc.array(token, { maxLength: 30 }),
      fc.integer({ min: 4, max: 40 }),
      (parts, columns) => {
        const source = parts.join(""),
          r = convert(source, { columns, paragraphIndent: 0 });
        expect(r.document.source).toBe(source);
        expect(r.document.nodes.map((n) => n.raw).join("")).toBe(source);
        expect(convert(source, { columns, paragraphIndent: 0 })).toEqual(r);
        expect(r.lines.every((line) => line.length <= columns)).toBe(true);
        expect(/^[\u2800-\u283f\n\f]*$/.test(r.unicode)).toBe(true);
        expect(brfToUnicode(r.brf)).toBe(r.unicode);
        for (const a of r.atoms) {
          expect(a.span.start).toBeGreaterThanOrEqual(0);
          expect(a.span.end).toBeLessThanOrEqual(source.length);
          expect(a.span.end).toBeGreaterThanOrEqual(a.span.start);
        }
        expect(r.atoms.length).toBeLessThan(source.length * 8 + 1);
      },
    ),
    { ...config, numRuns: 150 },
  );
});
it("parallel conversions and reflows have independent immutable state", async () => {
  const sources = [
    "你好27",
    "$a+b$",
    "\\ce{^{12}_{6}C}",
    "a\n\nb",
    "😀",
    "$\\text{重量}$",
  ];
  const serial = sources.map((s) => convert(s, { paragraphIndent: 0 }));
  expect(
    await Promise.all(
      sources.map(async (s) => convert(s, { paragraphIndent: 0 })),
    ),
  ).toEqual(serial);
  const encoded = encodeDocument("你好27abc"),
    snapshot = JSON.stringify(encoded);
  await Promise.all(
    [4, 10, 30, 40].map(async (columns) =>
      reflowExistingAtoms(encoded, { columns, paragraphIndent: 0 }),
    ),
  );
  expect(JSON.stringify(encoded)).toBe(snapshot);
});
it("hostile size/options fail within finite limits", () => {
  const r = convert("x".repeat(100001));
  expect(r.complete).toBe(false);
  expect(r.unhandled[0].raw).toHaveLength(100001);
  expect(r.diagnostics.some((d) => d.code === "resource-limit")).toBe(true);
  for (const rows of [NaN, Infinity, -1, 1e9])
    expect(convert("你", { rows }).complete).toBe(false);
  const atoms = Array.from({ length: 201 }, (_, i) => ({
    kind: "paragraph-break" as const,
    count: 1000,
    span: { start: i, end: i + 1 },
    group: `b${i}`,
    ruleId: "test",
    breakBefore: false,
    breakAfter: false,
  }));
  const huge = layout(atoms, { paragraphIndent: 0 });
  expect(huge.complete).toBe(false);
  expect(huge.lines).toEqual([]);
  expect(huge.diagnostics.some((d) => d.code === "layout-resource-limit")).toBe(
    true,
  );
});
it("many unknown units retain one placeholder each within the source bound", () => {
  const r = convert("😀".repeat(10000), { columns: 40, paragraphIndent: 0 });
  expect(r.unhandled).toHaveLength(10000);
  expect(r.atoms).toHaveLength(10000);
  expect(r.lines.every((line) => line.length <= 40)).toBe(true);
  expect(r.complete).toBe(false);
});
