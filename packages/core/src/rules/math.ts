import type { BrailleCellAtom, Diagnostic, SourceSpan } from "../model";
import type { MathExpression, MathSemanticNode as N } from "../parser/math";
import { simpleMappingColon } from "../parser/math";
import {
  SYMBOLS,
  FUNCTIONS,
  DIGITS,
  LOWER_DIGITS,
  LATIN_DOTS,
  GREEK_DOTS,
  braille,
} from "./math-symbols";
import { encodeText, type TextOptions } from "./text";
import type { ChineseWord } from "../language/chinese";
import type { ChineseEncodingOptions } from "./chinese";
export interface MathEncoding {
  chineseWords?: ChineseWord[];
  atoms: BrailleCellAtom[];
  diagnostics: Diagnostic[];
  unhandled: N[];
  complete: boolean;
}
export interface MathEncodingOptions {
  /** Semantic decision only; callers cannot supply cells. */
  colonMeaning?: (span: SourceSpan) => "ratio" | undefined;
  /** Explicit semantic rejection must override the narrow syntactic default. */
  mappingAllowed?: (span: SourceSpan) => boolean;
  physics?: boolean;
  chineseOverrides?: TextOptions["overrides"];
  wordBoundaries?: TextOptions["wordBoundaries"];
  analyzeChinese?: TextOptions["analyze"];
  chinese?: ChineseEncodingOptions;
  chemistry?: (
    node: Extract<N, { kind: "unknown" | "chemistry" }>,
  ) => MathEncoding;
}
const LETTER_FONTS: Readonly<Record<string, string>> = Object.freeze({
  mathrm: "1246",
  mathit: "146",
  textit: "146",
  mathbf: "12456",
});
const unwrap = (n: N): N =>
  n.kind === "group"
    ? unwrap(n.body)
    : n.kind === "sequence" && n.children.length === 1
      ? unwrap(n.children[0])
      : n;
/** Inspect a supported font wrapper's mathematical role without discarding it
 * from the emission tree. Unknown styles retain their diagnostic boundary. */
const semanticRole = (n: N): N => {
  n = unwrap(n);
  return n.kind === "style" && Object.hasOwn(LETTER_FONTS, n.name)
    ? semanticRole(n.body)
    : n;
};
const integer = (n: N): string | null => {
  n = unwrap(n);
  if (n.kind === "number" && /^\d+$/.test(n.value)) return n.value;
  if (
    n.kind === "sequence" &&
    n.children.length === 2 &&
    n.children[0].kind === "symbol" &&
    ["-", "+"].includes(n.children[0].value)
  ) {
    const v = integer(n.children[1]);
    return v === null ? null : n.children[0].value + v;
  }
  return null;
};
const lower = (v: string) =>
  Array.from(v, (c) =>
    c === "-" ? "36" : c === "+" ? "235" : LOWER_DIGITS[+c],
  );
function contains(n: N, kind: N["kind"]): boolean {
  if (n.kind === kind) return true;
  switch (n.kind) {
    case "sequence":
      return n.children.some((c) => contains(c, kind));
    case "group":
    case "style":
    case "accent":
    case "root":
      return contains(n.body, kind);
    case "script":
      return (
        contains(n.base, kind) ||
        (!!n.sub && contains(n.sub, kind)) ||
        (!!n.sup && contains(n.sup, kind))
      );
    default:
      return false;
  }
}
function simple(n: N): boolean {
  n = unwrap(n);
  switch (n.kind) {
    case "letter":
    case "number":
    case "script":
    case "root":
      return true;
    case "style":
      return simple(n.body);
    case "sequence":
      return (
        n.children.length > 0 &&
        n.children.every(
          (c) =>
            simple(c) ||
            (c.kind === "symbol" &&
              ["(", ")", "[", "]", "partial"].includes(c.value)),
        )
      );
    case "symbol":
      return n.value === "partial";
    default:
      return false;
  }
}
/** Stateless semantic encoder. No wrapping; diagnostics/unhandled are required consumer channels. */
export function encodeMath(
  expression: MathExpression,
  options: MathEncodingOptions = {},
): MathEncoding {
  const atoms: BrailleCellAtom[] = [];
  const chineseWords: ChineseWord[] = [];
  const diagnostics = [...expression.diagnostics];
  const unhandled: N[] = [];
  let serial = 0;
  let letterType = "";
  // Input policy: unstyled variables are normalized to Roman light. Its initial
  // marker may be omitted, but an explicit style and every later restoration
  // are encoded. A TeX group or mathematical operator is NOT a font terminator.
  let activeFont = "1246";
  let explicitFont = false;
  let emittedFont = "1246";
  let emittedFontMarker = false;
  const reset = () => {
    letterType = "";
  };
  const emit = (
    d: readonly string[],
    n: N,
    clause: string,
    span: SourceSpan = n.span,
  ) => {
    if (!d.length) return;
    atoms.push({
      kind: "cell",
      cells: braille(d),
      span,
      ruleId: "GBT18028-2010-" + clause,
      group: `math:${expression.span.start}:${serial++}`,
      breakBefore: false,
      breakAfter: true,
      continuation: { lineEnd: braille(["6"]), lineStart: "" },
    });
  };
  const blank = (n: N, count = 1) => {
    emit(Array(count).fill("0"), n, "5.4");
    const a = atoms.at(-1)!;
    a.breakBefore = true;
    a.continuation = { lineEnd: "", lineStart: "" };
    reset();
  };
  const problem = (n: N, code: string, message: string) => {
    unhandled.push(n);
    diagnostics.push({ code, severity: "warning", span: n.span, message });
  };
  const scoped = (n: N, context: Context = {}) => {
    reset();
    visit(n, { unary: true, ...context });
    reset();
  };
  interface Context {
    unary?: boolean;
    matrixCell?: boolean;
    forceFraction?: boolean;
  }
  const scriptValue = (n: N, direction: string[], clause: string) => {
    emit(direction, n, clause);
    const v = integer(n);
    if (v !== null) {
      emit(lower(v), n, clause);
      atoms.at(-1)!.group = atoms.at(-2)!.group;
    } else {
      scoped(n);
      emit(["156"], n, clause);
    }
    reset();
  };
  const sequence = (nodes: N[], context: Context) => {
    const mapping = simpleMappingColon({kind:"sequence",children:nodes,raw:"",span:expression.span});
    let previous: N | undefined;
    let angle = false;
    for (let index = 0; index < nodes.length; index++) {
      const n = nodes[index];
      if (mapping && n.span.start === mapping.start && options.mappingAllowed?.(mapping) === false && options.colonMeaning?.(mapping) !== "ratio") {
        problem(n,"math-mapping-unresolved","Mapping syntax retained pending an explicit semantic decision.");
        previous = n;
        continue;
      }
      if (mapping && n.span.start === mapping.start && options.colonMeaning?.(mapping) !== "ratio") {
        emit(["36"], n, "6.18");
        blank(n);
        reset();
        previous = n;
        continue;
      }
      // A recurring decimal is one number, not a pair of derivative annotations.
      if (
        n.kind === "number" &&
        n.value.includes(".") &&
        nodes[index + 1]?.kind === "accent"
      ) {
        let end = index + 1;
        const digits: string[] = [];
        let marked = 0;
        while (end < nodes.length) {
          const p = nodes[end];
          if (p.kind === "accent" && p.name === "dot") {
            const v = integer(p.body);
            if (v === null || !/^\d+$/.test(v)) {
              problem(
                p,
                "math-invalid-recurrence",
                "A recurring decimal mark must contain unsigned digits; annotation retained.",
              );
              break;
            }
            digits.push(...Array.from(v, (c) => DIGITS[+c]));
            marked++;
            end++;
            if (marked === 2) break;
          } else if (p.kind === "number" && /^\d+$/.test(p.value)) {
            digits.push(...Array.from(p.value, (c) => DIGITS[+c]));
            end++;
          } else break;
        }
        if (marked === 0)
          problem(
            n,
            "math-invalid-recurrence",
            "Decimal recurrence requires marked digits.",
          );
        if (marked > 0) {
          emit(
            [
              "3456",
              ...Array.from(n.value, (c) => (c === "." ? "2" : DIGITS[+c])),
              "5",
              ...digits,
            ],
            n,
            "5.1",
            { start: n.span.start, end: nodes[end - 1].span.end },
          );
          reset();
          index = end - 1;
          previous = n;
          continue;
        }
      }
      if (n.kind === "format") continue;
      if (
        n.kind === "script" &&
        n.sup &&
        unwrap(n.sup).kind === "symbol" &&
        (unwrap(n.sup) as N & { value: string }).value === "circ"
      ) {
        visit(n, context);
        reset();
        angle = true;
        previous = n;
        continue;
      }
      if (angle && n.kind === "symbol" && n.value === "'") {
        emit(["5", "35"], n, "5.3");
        reset();
        previous = n;
        continue;
      }
      const unary =
        !previous ||
        (previous.kind === "symbol" &&
          ["=", "(", "[", "{", "+", "-", "times", "div", ":"].includes(
            previous.value,
          ));
      const previousSemantic = previous ? semanticRole(previous) : undefined;
      const previousBase =
        previousSemantic?.kind === "script"
          ? semanticRole(previousSemantic.base)
          : previousSemantic;
      const argument = semanticRole(n);
      const functionArgument = previousBase?.kind === "function";
      if (
        functionArgument &&
        n.kind === "symbol" &&
        ["-", "+"].includes(n.value)
      )
        problem(
          n,
          "math-function-argument-unverified",
          "Signed function argument needs explicit grouping under §6.9.2.2.",
        );
      if (
        functionArgument &&
        previousBase?.value === "log" &&
        argument.kind === "fraction" &&
        previousSemantic?.kind === "script" &&
        previousSemantic.sub &&
        integer(previousSemantic.sub) !== null
      )
        emit(["6"], n, "6.7");
      if (
        n.kind === "symbol" &&
        n.value === ":" &&
        previous?.kind === "number" &&
        nodes[index + 1]?.kind === "number" &&
        options.colonMeaning?.(n.span) !== "ratio"
      )
        problem(
          n,
          "math-colon-ambiguous",
          "Colon defaults to ratio; clock time needs explicit contextual semantics.",
        );
      visit(n, {
        ...context,
        unary,
        forceFraction:
          context.forceFraction ||
          (functionArgument && argument.kind === "fraction"),
      });
      previous = n;
    }
  };
  const visitNode = (n: N, context: Context = {}) => {
    switch (n.kind) {
      case "sequence":
        sequence(n.children, context);
        return;
      case "group":
        visit(n.body, context);
        return;
      case "format":
        return;
      case "unknown":
        unhandled.push(n);
        reset();
        return;
      case "chemistry": {
        if (options.chemistry) {
          const result = options.chemistry(n);
          const namespace = `math-ce:${expression.span.start}:${serial++}`;
          if (!result.complete)
            problem(
              n,
              "math-chemistry-incomplete",
              "Delegated chemistry conversion is incomplete.",
            );
          atoms.push(
            ...result.atoms.map((a) => ({
              ...a,
              group: `${namespace}:${a.group}`,
            })),
          );
          diagnostics.push(...result.diagnostics);
          chineseWords.push(...(result.chineseWords ?? []));
          unhandled.push(...result.unhandled);
        } else
          problem(
            n,
            "math-chemistry-deferred",
            "Chemical source retained for the chemistry encoder.",
          );
        reset();
        return;
      }
      case "number":
        emit(
          [
            "3456",
            ...Array.from(n.value, (c) => (c === "." ? "2" : DIGITS[+c])),
          ],
          n,
          "5.1",
        );
        reset();
        return;
      case "letter": {
        const isLatin = /^[A-Za-z]$/.test(n.value);
        const small = n.value === n.value.toLowerCase();
        const type = isLatin ? (small ? "56" : "6") : small ? "46" : "456";
        const pos = isLatin
          ? n.value.toLowerCase().charCodeAt(0) - 97
          : Array.from("αβγδεζηθικλμνξοπρστυφχψω").indexOf(
              n.value.toLowerCase(),
            );
        const d = (isLatin ? LATIN_DOTS : GREEK_DOTS)[pos];
        if (!d) {
          problem(
            n,
            "math-unsupported-letter",
            "Letter variant has no independently checked mapping.",
          );
          reset();
          return;
        }
        const fontChange =
          activeFont !== emittedFont || (explicitFont && !emittedFontMarker);
        emit(
          [
            ...(letterType === type ? [] : [type]),
            ...(fontChange ? [activeFont] : []),
            d,
          ],
          n,
          "5.2",
        );
        if (fontChange) emittedFontMarker = true;
        emittedFont = activeFont;
        letterType = type;
        return;
      }
      case "symbol": {
        const rule = SYMBOLS[n.value];
        if (!rule) {
          problem(n, "math-unsupported-symbol", "No semantic rule for symbol.");
          return;
        }
        const unary =
          context.unary && ["+", "-", "−", "pm", "mp"].includes(n.value);
        if (!unary && rule.spacing !== "none") {
          if (context.matrixCell && ["+", "-", "−"].includes(n.value))
            emit(["5"], n, "6.17");
          else blank(n);
        }
        emit(rule.dots, n, rule.clause);
        if (rule.spacing === "both") blank(n);
        if (rule.spacing === "because") blank(n, 2);
        if (n.value === ",") blank(n);
        if (n.value === "oint") emit(["156"], n, "6.14");
        reset();
        return;
      }
      case "function":
        emit(
          FUNCTIONS[n.value],
          n,
          n.value === "log" || n.value === "lg" || n.value === "ln"
            ? "6.7"
            : [
                  "sin",
                  "cos",
                  "tan",
                  "cot",
                  "sec",
                  "csc",
                  "arcsin",
                  "arccos",
                  "arctan",
                ].includes(n.value)
              ? "6.9"
              : "6.14",
        );
        reset();
        return;
      case "fraction": {
        const a = integer(n.numerator),
          b = integer(n.denominator);
        if (
          a !== null &&
          b !== null &&
          /^\d+$/.test(a) &&
          /^\d+$/.test(b) &&
          !context.forceFraction
        ) {
          emit(
            ["3456", ...Array.from(a, (c) => DIGITS[+c]), ...lower(b)],
            n,
            "6.4",
          );
          reset();
          return;
        }
        if (
          contains(n.numerator, "fraction") ||
          contains(n.denominator, "fraction")
        )
          problem(
            n,
            "math-compound-fraction-unverified",
            "Multilevel fraction line hierarchy (§6.4.2.8) requires review; source retained.",
          );
        const frame =
          context.forceFraction ||
          !simple(n.numerator) ||
          !simple(n.denominator);
        if (frame) emit(["23"], n, "6.4");
        scoped(n.numerator);
        if (frame) blank(n);
        emit(["1256"], n, "6.4");
        scoped(n.denominator);
        if (frame) emit(["56"], n, "6.4");
        reset();
        return;
      }
      case "root": {
        emit(["146"], n, "6.6");
        if (n.index) {
          const v = integer(n.index);
          if (v !== null) emit(lower(v), n.index, "6.6");
          else scoped(n.index);
        }
        emit(["156"], n, "6.6");
        scoped(n.body);
        emit(["1456"], n, "6.6");
        reset();
        return;
      }
      case "script": {
        const b = semanticRole(n.base);
        scoped(n.base, context);
        const large =
          (b.kind === "symbol" &&
            [
              "sum",
              "prod",
              "int",
              "iint",
              "iiint",
              "oint",
              "bigcup",
              "bigcap",
            ].includes(b.value)) ||
          (b.kind === "function" &&
            ["lim", "limsup", "liminf", "max", "min", "sup", "inf"].includes(
              b.value,
            ));
        if (large) {
          if (n.sub) {
            emit(["46", "16"], n.sub, "6.14");
            const v = integer(n.sub);
            if (v !== null) emit(lower(v), n.sub, "6.14");
            else scoped(n.sub);
          }
          if (n.sup) {
            emit(["46", "34"], n.sup, "6.14");
            const v = integer(n.sup);
            if (v !== null) emit(lower(v), n.sup, "6.14");
            else scoped(n.sup);
          }
          const integral =
            b.kind === "symbol" && ["int", "iint", "iiint"].includes(b.value);
          if (!integral || !n.sup || integer(n.sup) === null)
            emit(["156"], n, "6.14");
          reset();
          return;
        }
        if (n.sub) {
          if (n.sup && b.kind === "function" && b.value === "log") {
            emit(["16"], n.sub, "6.7");
            scoped(n.sub);
            emit(["156"], n.sub, "6.7");
          } else scriptValue(n.sub, ["16"], "6.5");
        }
        if (n.sup) {
          const upper = unwrap(n.sup);
          if (upper.kind === "symbol" && upper.value === "circ") {
            emit(["5", "356"], n.sup, "5.3");
            reset();
            return;
          }
          const fraction = contains(n.sup, "fraction");
          if (fraction) {
            emit(["34", "6"], n.sup, "6.6");
            scoped(n.sup, { forceFraction: true });
            emit(["156"], n.sup, "6.6");
          } else scriptValue(n.sup, ["34"], "6.6");
        }
        reset();
        return;
      }
      case "accent": {
        scoped(n.body);
        if (n.name === "dot" || n.name === "ddot")
          emit(n.name === "dot" ? ["2"] : ["2", "2"], n, "6.14");
        else if (["bar", "overline"].includes(n.name)) {
          emit(["45", "25", "156"], n, "6.5");
          if (unwrap(n.body).kind !== "letter")
            problem(
              n,
              "math-position-mark-unverified",
              "Upper line position encoded conservatively; complete §6.5.2 scope is not verified.",
            );
        } else if (n.name === "vec" || n.name === "overrightarrow") {
          const body = unwrap(n.body);
          const length =
            body.kind === "letter"
              ? 1
              : body.kind === "sequence" &&
                  body.children.every((c) => c.kind === "letter")
                ? body.children.length
                : 0;
          if (length === 1 || length === 2) {
            emit(["45", "25", length === 1 ? "2" : "23", "156"], n, "6.15");
            blank(n);
          }
          problem(
            n,
            "math-vector-mark-unverified",
            "Vector position convention requires review; body and annotation retained.",
          );
        } else
          problem(
            n,
            "math-unsupported-accent",
            "Accent retained; no checked rule.",
          );
        reset();
        return;
      }
      case "style": {
        const font = Object.hasOwn(LETTER_FONTS, n.name)
          ? LETTER_FONTS[n.name]
          : undefined;
        if (!font) {
          problem(
            n,
            "math-font-unverified",
            "Explicit " +
              n.name +
              " retained; complete font indicators under §5.2.2 are not verified.",
          );
          scoped(n.body, context);
          return;
        }
        const previousFont = activeFont,
          previousExplicit = explicitFont;
        if (n.name === "textit" && /\s/.test(n.body.raw)) {
          problem(
            n,
            "math-font-text-unverified",
            "Literal textit whitespace semantics are outside the checked letter-font adapter; original scope retained.",
          );
        }
        activeFont = font;
        explicitFont = true;
        visit(n.body, context);
        activeFont = previousFont;
        explicitFont = previousExplicit;
        return;
      }
      case "text": {
        if (explicitFont) {
          problem(
            n,
            "math-font-text-unverified",
            "Checked mathematical letter-font rules do not establish styled prose/Chinese typography; text retained.",
          );
        }
        const result = encodeText(n.value, n.span.start, {
          chinese: options.chinese,
          overrides: options.chineseOverrides,
          wordBoundaries: options.wordBoundaries,
          analyze: options.analyzeChinese,
          mathText: true,
        });
        const namespace = `math-text:${expression.span.start}:${serial++}`;
        atoms.push(
          ...result.atoms.map((a) => ({
            ...a,
            group: `${namespace}:${a.group}`,
          })),
        );
        diagnostics.push(...result.diagnostics);
        chineseWords.push(...result.words);
        for (const u of result.unhandled)
          problem(
            { kind: "text", value: u.raw, raw: u.raw, span: u.span },
            "math-text-unhandled",
            "Text character retained without a checked encoding.",
          );
        reset();
        return;
      }
      case "matrix": {
        const cases = ["cases", "aligned", "gathered"].includes(n.environment);
        if (n.environment === "gathered" && n.rows.some(row => row.length !== 1))
          problem(n,"math-gathered-columns-unsupported","Gathered supports one expression per row; alignment columns require aligned.");
        const matrixBegin = atoms.length;
        if (n.rows.some((row) => row.length !== n.rows[0].length))
          problem(
            n,
            "math-ragged-matrix",
            "Unequal matrix row widths retained for review.",
          );
        const brackets: Record<string, string[]> = {
          pmatrix: ["126", "345"],
          bmatrix: ["12356", "23456"],
          Bmatrix: ["246", "135"],
          vmatrix: ["456", "456"],
          Vmatrix: ["12456", "12456"],
          matrix: [],
        };
        if (cases && n.environment === "cases") emit(["246", "3"], n, "6.3");
        n.rows.forEach((row, r) => {
          if (r) {
            emit(["46", "1256"], n, cases ? "6.3" : "6.17");
            if (!cases) atoms.at(-1)!.rowSeparator = true;
          }
          const rowBegin = atoms.length;
          const b = brackets[n.environment] ?? [];
          if (b[0]) emit([b[0]], n, "6.17");
          row.forEach((cell, c) => {
            if (c) blank(cell);
            scoped(cell, { matrixCell: !cases });
          });
          if (b[1]) emit([b[1]], n, "6.17");
          if (!cases && atoms.length > rowBegin) {
            atoms[rowBegin].rowStart = true;
            atoms[rowBegin].continuationIndent = 2;
            if (r < n.rows.length - 1) atoms.at(-1)!.rowEnd = true;
          }
        });
        if (n.environment === "cases") emit(["4", "135"], n, "6.3");
        if (cases && atoms.length > matrixBegin) {
          atoms[matrixBegin].rowStart = true;
          atoms[matrixBegin].continuationIndent = 2;
        }
        reset();
        return;
      }
    }
  };
  const visit = (n: N, context: Context = {}) => {
    const first = atoms.length;
    visitNode(n, context);
    // Conservative supported-break policy: structural prefixes, payloads and
    // ending markers stay together. Never hard-cut a root/fraction/script.
    if (
      ["fraction", "root", "script", "accent"].includes(n.kind) &&
      !(n.kind === "script" && contains(n.base, "matrix")) &&
      atoms.length > first
    ) {
      const group = `math-structure:${expression.span.start}:${serial++}`;
      for (let i = first; i < atoms.length; i++) atoms[i].group = group;
    }
  };
  let matrixCount = 0;
  const inspectMatrices = (n: N, structural = false) => {
    if (n.kind === "matrix") {
      if (!["cases", "aligned", "gathered"].includes(n.environment))
        matrixCount++;
      if (structural)
        problem(
          n,
          "math-matrix-context-unverified",
          "Nested/structural matrix placement is outside the checked standalone-row profile.",
        );
      n.rows.flat().forEach((c) => inspectMatrices(c, true));
    } else if (n.kind === "sequence")
      n.children.forEach((c) => inspectMatrices(c, structural));
    else if (n.kind === "group" || n.kind === "style")
      inspectMatrices(n.body, structural);
    else if (n.kind === "fraction") {
      inspectMatrices(n.numerator, true);
      inspectMatrices(n.denominator, true);
    } else if (n.kind === "root" || n.kind === "accent")
      inspectMatrices(n.body, true);
    else if (n.kind === "script") {
      inspectMatrices(n.base, structural);
      if (n.sub) inspectMatrices(n.sub, true);
      if (n.sup) inspectMatrices(n.sup, true);
    }
  };
  inspectMatrices(expression.body);
  if (matrixCount > 1)
    problem(
      expression.body,
      "math-matrix-composition-unverified",
      "Multi-matrix/planar composition requires separately checked blank-line and page placement.",
    );
  visit(expression.body);
  // A preceding nonblank boundary adjoining a blank is a normal blank break.
  for (let j = 0; j < atoms.length - 1; j++)
    if (/^\u2800+$/.test(atoms[j + 1].cells))
      atoms[j].continuation = { lineEnd: "", lineStart: "" };
  return {
    atoms,
    chineseWords,
    diagnostics,
    unhandled,
    complete:
      unhandled.length === 0 &&
      !diagnostics.some((d) => d.severity === "error"),
  };
}
