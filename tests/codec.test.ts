import { it, expect } from "vitest";
import {
  unicodeToBrf,
  brfToUnicode,
  unicodeToBrfDetailed,
  brfToUnicodeDetailed,
} from "../packages/core/src/codec";
import { braille } from "../packages/core/src/rules/math-symbols";
// Independent GB18028 Appendix B transcription, ASCII32–95, evidence pp110–111.
const dots =
  "0 2346 5 3456 1246 146 12346 3 12356 23456 16 346 6 36 46 34 356 2 23 25 256 26 235 2356 236 35 156 56 126 123456 345 1456 4 1 12 14 145 15 124 1245 125 24 245 13 123 134 1345 135 1234 12345 1235 234 2345 136 1236 2456 1346 13456 1356 246 1256 12456 45 456".split(
    " ",
  );
it.each(dots.map((d, i) => [d, String.fromCharCode(32 + i)]))(
  "independent carrier %s / %s",
  (d, c) => {
    expect(brfToUnicode(c)).toBe(braille([d]));
    expect(unicodeToBrf(braille([d]))).toBe(c);
  },
);
it("roundtrips every six-dot mask, line and page separators", () => {
  const s =
    Array.from({ length: 64 }, (_, m) => String.fromCharCode(0x2800 + m)).join(
      "",
    ) + "\n\f";
  expect(brfToUnicode(unicodeToBrf(s))).toBe(s);
});
it("rejects illegal carrier characters without silent deletion", () => {
  for (const s of ["a", "\t", "中", "😀"]) {
    const r = brfToUnicodeDetailed(s);
    expect(r.complete).toBe(false);
    expect(r.diagnostics[0].span).toEqual({ start: 0, end: s.length });
    expect(() => brfToUnicode(s)).toThrow();
  }
  expect(unicodeToBrfDetailed("\u2840").complete).toBe(false);
  expect(() => unicodeToBrf("A")).toThrow();
});
