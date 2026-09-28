import type { Diagnostic } from "./model";
/** GB/T18028-2010 Appendix B, ASCII 32..95. Transport, never source translation. */
const ASCII_DOTS =
  "0 2346 5 3456 1246 146 12346 3 12356 23456 16 346 6 36 46 34 356 2 23 25 256 26 235 2356 236 35 156 56 126 123456 345 1456 4 1 12 14 145 15 124 1245 125 24 245 13 123 134 1345 135 1234 12345 1235 234 2345 136 1236 2456 1346 13456 1356 246 1256 12456 45 456".split(
    " ",
  );
const cells = ASCII_DOTS.map((d) =>
  String.fromCharCode(
    0x2800 + [...d].reduce((m, n) => (n === "0" ? m : m | (1 << (+n - 1))), 0),
  ),
);
export const isSixDot = (value: string, allowEmpty = false): boolean =>
  (allowEmpty || value.length > 0) && /^[\u2800-\u283f]*$/.test(value);
export interface CodecResult {
  value: string;
  diagnostics: Diagnostic[];
  complete: boolean;
}
function translate(input: string, reverse: boolean): CodecResult {
  const result: CodecResult = { value: "", diagnostics: [], complete: true };
  let offset = 0;
  for (const char of input) {
    let out: string | undefined;
    if (char === "\n" || char === "\f" || char === "\r") out = char;
    else if (reverse) {
      const code = char.charCodeAt(0);
      if (code >= 32 && code <= 95) out = cells[code - 32];
    } else {
      const index = cells.indexOf(char);
      if (index >= 0) out = String.fromCharCode(32 + index);
    }
    if (out === undefined) {
      result.complete = false;
      result.diagnostics.push({
        code: "codec-invalid-character",
        severity: "error",
        span: { start: offset, end: offset + char.length },
        message: reverse
          ? "BRF accepts canonical ASCII32–95 and CR/LF/formfeed only."
          : "Unicode export accepts six-dot braille and CR/LF/formfeed only.",
      });
    } else result.value += out;
    offset += char.length;
  }
  if (!result.complete) result.value = "";
  return result;
}
export const unicodeToBrfDetailed = (input: string): CodecResult =>
  translate(input, false);
export const brfToUnicodeDetailed = (input: string): CodecResult =>
  translate(input, true);
function checked(result: CodecResult): string {
  if (!result.complete) throw new Error(result.diagnostics[0].message);
  return result.value;
}
export const unicodeToBrf = (input: string): string =>
  checked(unicodeToBrfDetailed(input));
export const brfToUnicode = (input: string): string =>
  checked(brfToUnicodeDetailed(input));
