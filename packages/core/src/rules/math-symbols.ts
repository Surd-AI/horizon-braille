/** GB/T18028-2010 independent visual transcription; math-standard-evidence.md. */
export interface SymbolRule {
  dots: readonly string[];
  spacing: "none" | "before" | "both" | "because";
  clause: string;
}
const s = (
  dots: string,
  spacing: SymbolRule["spacing"] = "none",
  clause = "6.1",
): SymbolRule =>
  Object.freeze({ dots: Object.freeze(dots.split(" ")), spacing, clause });
const BASE_SYMBOLS: Record<string, SymbolRule> = {
  "+": s("235", "before"),
  "-": s("36", "before"),
  "−": s("36", "before"),
  pm: s("235 36", "before"),
  mp: s("36 235", "before"),
  times: s("236", "before"),
  cdot: s("3"),
  div: s("256", "before"),
  "=": s("2356", "before"),
  neq: s("4 2356"),
  ne: s("4 2356"),
  approx: s("26 26", "before"),
  equiv: s("56 2356", "before"),
  ":": s("5 25"),
  propto: s("25 2356", "before"),
  ">": s("135", "both", "6.2"),
  "<": s("246", "both", "6.2"),
  ge: s("135 2356", "before", "6.2"),
  geq: s("135 2356", "before", "6.2"),
  geqslant: s("135 2356", "before", "6.2"),
  le: s("246 2356", "before", "6.2"),
  leq: s("246 2356", "before", "6.2"),
  leqslant: s("246 2356", "before", "6.2"),
  "|": s("456", "none", "6.2"),
  vert: s("456", "none", "6.2"),
  "(": s("126", "none", "6.3"),
  ")": s("345", "none", "6.3"),
  "[": s("12356", "none", "6.3"),
  "]": s("23456", "none", "6.3"),
  "{": s("246", "none", "6.3"),
  "}": s("135", "none", "6.3"),
  lbrace: s("246", "none", "6.3"),
  rbrace: s("135", "none", "6.3"),
  "/": s("6 1256", "none", "6.4"),
  "%": s("3456 245 356", "none", "6.4"),
  infty: s("3456 123456", "none", "5.1"),
  ",": s("5", "none", "5.4"),
  ".": s("2", "none", "5.1"),
  "'": s("35", "none", "6.14"),
  circ: s("5 356", "none", "5.3"),
  sum: s("456 234", "none", "6.12"),
  prod: s("456 1234", "none", "6.12"),
  int: s("2346", "none", "6.14"),
  iint: s("2346 2346", "none", "6.14"),
  iiint: s("2346 2346 2346", "none", "6.14"),
  oint: s("2346 356", "none", "6.14"),
  partial: s("1456", "none", "6.14"),
  nabla: s("1246 356", "none", "6.14"),
  to: s("25 135", "before", "6.14"),
  rightarrow: s("25 135", "before", "6.14"),
  angle: s("1246 246", "none", "6.8"),
  triangle: s("1246 256", "none", "6.8"),
  square: s("1246 2356", "none", "6.8"),
  parallel: s("123 123", "before", "6.8"),
  perp: s("3456 3", "before", "6.8"),
  cong: s("35 2356", "before", "6.8"),
  sim: s("35", "before", "6.8"),
  because: s("16 1", "because", "6.8"),
  therefore: s("34 3", "because", "6.8"),
  Leftrightarrow: s("126 2356 345", "before", "6.8"),
  Rightarrow: s("2356 345", "before", "6.8"),
  in: s("5 246", "both", "6.18"),
  notin: s("45 246", "none", "6.18"),
  exists: s("135 2", "both", "6.18"),
  nexists: s("4 135 2", "none", "6.18"),
  subset: s("12346", "both", "6.18"),
  supset: s("1456", "both", "6.18"),
  nsubset: s("4 12346", "none", "6.18"),
  nsupset: s("4 1456", "none", "6.18"),
  sqsubset: s("12346 12346", "both", "6.18"),
  sqsupset: s("1456 1456", "both", "6.18"),
  prec: s("25 246", "both", "6.18"),
  succ: s("135 25", "both", "6.18"),
  preceq: s("25 246 2356", "before", "6.18"),
  succeq: s("135 25 2356", "before", "6.18"),
  subseteq: s("12346 2356", "before", "6.18"),
  supseteq: s("1456 2356", "before", "6.18"),
  emptyset: s("4 356", "none", "6.18"),
  varnothing: s("4 356", "none", "6.18"),
  cup: s("56 356", "before", "6.18"),
  cap: s("56 256", "before", "6.18"),
  bigcup: s("456 3456", "none", "6.18"),
  bigcap: s("56 1456", "none", "6.18"),
  setminus: s("56 36", "none", "6.18"),
  aleph: s("4 1", "none", "6.18"),
  mapsto: s("456 25 135", "none", "6.18"),
  leftrightarrow: s("246 25 135", "none", "6.18"),
};
export const SYMBOL_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  "≤": "leq",
  "≥": "geq",
  "≠": "neq",
  "≈": "approx",
  "≡": "equiv",
  "±": "pm",
  "∓": "mp",
  "×": "times",
  "÷": "div",
  "·": "cdot",
  "∞": "infty",
  "∈": "in",
  "∉": "notin",
  "⊂": "subset",
  "⊃": "supset",
  "⊄": "nsubset",
  "⊅": "nsupset",
  "⊏": "sqsubset",
  "⊐": "sqsupset",
  "≺": "prec",
  "≻": "succ",
  "≼": "preceq",
  "≽": "succeq",
  "↦": "mapsto",
  "↔": "leftrightarrow",
  "⊆": "subseteq",
  "⊇": "supseteq",
  "∪": "cup",
  "∩": "cap",
  "∅": "emptyset",
  "∂": "partial",
  "∇": "nabla",
  "∑": "sum",
  "∏": "prod",
  "∫": "int",
  "∠": "angle",
});
export const SYMBOLS: Readonly<Record<string, SymbolRule>> = Object.freeze({
  ...BASE_SYMBOLS,
  ...Object.fromEntries(
    Object.entries(SYMBOL_ALIASES).map(([k, v]) => [k, BASE_SYMBOLS[v]]),
  ),
});
export const FUNCTIONS: Readonly<Record<string, readonly string[]>> =
  Object.freeze(
    Object.fromEntries(
      Object.entries({
        log: "1246 123",
        lg: "1246 123 1245",
        ln: "1246 123 1345",
        sin: "1246 234",
        cos: "1246 14",
        tan: "1246 2345",
        cot: "1246 14 2345",
        sec: "1246 234 14",
        csc: "1246 14 234",
        arcsin: "1246 1 234",
        arccos: "1246 1 14",
        arctan: "1246 1 2345",
        max: "1246 134 1346",
        min: "1246 134 1345",
        sup: "1246 234 136 1234",
        inf: "1246 24 1345 124",
        sgn: "1246 234 1245 1345",
        const: "1246 14 234 2345",
        exp: "1246 15",
        lim: "1246 123 134",
        limsup: "1246 123 134 234",
        liminf: "1246 123 134 24",
        res: "1246 1235 234",
        grad: "1246 1245",
        divergence: "1246 145",
        rot: "1246 1235",
        det: "1246 145 2345",
      }).map(([k, v]) => [k, Object.freeze(v.split(" "))]),
    ),
  );
export const GREEK_COMMANDS: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega"
      .split(" ")
      .flatMap((n, i) => [
        [n, Array.from("αβγδεζηθικλμνξοπρστυφχψω")[i]],
        [
          n[0].toUpperCase() + n.slice(1),
          Array.from("ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ")[i],
        ],
      ]),
  ),
);
export const LATIN_DOTS = Object.freeze(
  "1 12 14 145 15 124 1245 125 24 245 13 123 134 1345 135 1234 12345 1235 234 2345 136 1236 2456 1346 13456 1356".split(
    " ",
  ),
);
export const GREEK_DOTS = Object.freeze(
  "1 12 1245 145 15 1356 156 1456 24 13 123 134 1345 1346 135 1234 1235 234 2345 136 124 12346 13456 2456".split(
    " ",
  ),
);
export const DIGITS = Object.freeze(
  "245 1 12 14 145 15 124 1245 125 24".split(" "),
);
export const LOWER_DIGITS = Object.freeze(
  "356 2 23 25 256 26 235 2356 236 35".split(" "),
);
// Unicode presentation digits are accepted as source syntax for the same
// semantic scripts as ^{...} and _{...}; they do not introduce new braille cells.
export const UNICODE_SUPERSCRIPT_DIGITS: Readonly<Record<string, string>> = Object.freeze({
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
  "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
  "⁺": "+", "⁻": "-",
});
export const UNICODE_SUBSCRIPT_DIGITS: Readonly<Record<string, string>> = Object.freeze({
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4",
  "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
});
export function braille(dots: readonly string[]): string {
  return dots
    .map((d) =>
      String.fromCharCode(
        0x2800 +
          Array.from(d).reduce(
            (n, c) => (c === "0" ? n : n | (1 << (Number(c) - 1))),
            0,
          ),
      ),
    )
    .join("");
}
