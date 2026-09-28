import type { Diagnostic, SourceSpan } from "../model";
import {
  SYMBOLS,
  FUNCTIONS,
  GREEK_COMMANDS,
  SYMBOL_ALIASES,
  UNICODE_SUPERSCRIPT_DIGITS,
  UNICODE_SUBSCRIPT_DIGITS,
} from "../rules/math-symbols";
interface Base {
  raw: string;
  span: SourceSpan;
}
export type MathSemanticNode = Base &
  (
    | { kind: "sequence"; children: MathSemanticNode[] }
    | {
        kind: "number" | "letter" | "symbol" | "function" | "text";
        value: string;
      }
    | { kind: "group"; body: MathSemanticNode }
    | {
        kind: "fraction";
        numerator: MathSemanticNode;
        denominator: MathSemanticNode;
      }
    | { kind: "root"; body: MathSemanticNode; index?: MathSemanticNode }
    | {
        kind: "script";
        base: MathSemanticNode;
        sub?: MathSemanticNode;
        sup?: MathSemanticNode;
      }
    | { kind: "accent" | "style"; name: string; body: MathSemanticNode }
    | { kind: "matrix"; environment: string; rows: MathSemanticNode[][] }
    | { kind: "format"; name: string }
    | { kind: "unknown" | "chemistry"; reason: string }
  );
/** Domain expression, distinct from the document's delimited MathNode wrapper. */
export interface MathExpression extends Base {
  kind: "math-expression";
  body: MathSemanticNode;
  diagnostics: Diagnostic[];
}
/** The narrow form directly illustrated by GB/T18028 §6.18.2 example 8. */
export function simpleMappingColon(body: MathSemanticNode): SourceSpan | undefined {
  if (body.kind !== "sequence" || body.children.length !== 5) return;
  const [f, colon, domain, arrow, range] = body.children;
  if ([f,domain,range].every(n => n.kind === "letter" && /^[A-Za-z]$/.test(n.value)) &&
    colon.kind === "symbol" && colon.value === ":" && arrow.kind === "symbol" &&
    ["to","rightarrow"].includes(arrow.value)) return colon.span;
}
export interface MathParseOptions {
  maxDepth?: number;
  maxLength?: number;
}
const FORMATTING = new Set([
  "left",
  "right",
  "big",
  "Big",
  "bigg",
  "Bigg",
  "bigl",
  "bigr",
  "Bigl",
  "Bigr",
  "limits",
  "nolimits",
  "displaystyle",
  "textstyle",
  "scriptstyle",
  "scriptscriptstyle",
  ",",
  ";",
  "!",
  "quad",
  "qquad",
  "enspace",
  " ",
]);
export const STYLES = new Set([
  "mathrm",
  "mathbf",
  "mathit",
  "mathsf",
  "mathtt",
  "mathcal",
  "mathbb",
  "textit",
  "textbf",
  "textrm",
  "boldsymbol",
]);
export const ENVIRONMENTS = new Set([
  "matrix",
  "pmatrix",
  "bmatrix",
  "Bmatrix",
  "vmatrix",
  "Vmatrix",
  "cases",
  "aligned",
  "gathered",
]);
export function parseMath(
  raw: string,
  span: SourceSpan = { start: 0, end: raw.length },
  options: MathParseOptions = {},
): MathExpression {
  const diagnostics: Diagnostic[] = [];
  const base = span.start;
  const maxDepth = Math.max(
    1,
    Math.min(128, Number.isFinite(options.maxDepth) ? options.maxDepth! : 64),
  );
  const maxLength = Math.max(
    1,
    Math.min(
      1000000,
      Number.isFinite(options.maxLength) ? options.maxLength! : 100000,
    ),
  );
  let i = 0;
  const location = (start: number, end = i): Base => ({
    raw: raw.slice(start, end),
    span: { start: base + start, end: base + end },
  });
  const diagnose = (
    code: string,
    start: number,
    end: number,
    message: string,
  ) =>
    diagnostics.push({
      code,
      severity: "error",
      span: { start: base + start, end: base + end },
      message,
    });
  const unknown = (start: number, reason: string): MathSemanticNode => ({
    kind: "unknown",
    reason,
    ...location(start),
  });
  const white = () => {
    while (/\s/.test(raw[i] ?? "") && i < raw.length) i++;
  };
  const literalGroup = (): {
    value: string;
    start: number;
    end: number;
    closed: boolean;
  } => {
    white();
    const start = i;
    if (raw[i] !== "{") {
      const cp = String.fromCodePoint(raw.codePointAt(i) ?? 32);
      i = Math.min(raw.length, i + cp.length);
      return { value: raw.slice(start, i), start, end: i, closed: false };
    }
    i++;
    const content = i;
    let level = 1;
    while (i < raw.length && level) {
      if (raw[i] === "\\") {
        i += Math.min(2, raw.length - i);
        continue;
      }
      if (raw[i] === "{") level++;
      if (raw[i] === "}") level--;
      i++;
    }
    if (level)
      diagnose("math-unclosed-group", start, i, "Unclosed literal group.");
    return {
      value: raw.slice(content, level ? i : i - 1),
      start: content,
      end: level ? i : i - 1,
      closed: !level,
    };
  };
  const argument = (depth: number): MathSemanticNode => {
    white();
    if (i >= raw.length || raw[i] === "}") {
      diagnose("math-missing-argument", i, i, "Missing required argument.");
      return unknown(i, "missing argument");
    }
    return atom(depth, true);
  };
  const sequence = (depth: number, stop?: string): MathSemanticNode => {
    const start = i;
    const children: MathSemanticNode[] = [];
    while (i < raw.length) {
      white();
      if (i >= raw.length || (stop && raw[i] === stop)) break;
      if (raw[i] === "}") {
        const s = i++;
        diagnose("math-unexpected-close", s, i, "Unexpected closing group.");
        children.push(unknown(s, "unexpected group close"));
        continue;
      }
      const unicodeScript = Object.hasOwn(UNICODE_SUPERSCRIPT_DIGITS, raw[i] ?? "")
        ? UNICODE_SUPERSCRIPT_DIGITS
        : Object.hasOwn(UNICODE_SUBSCRIPT_DIGITS, raw[i] ?? "")
          ? UNICODE_SUBSCRIPT_DIGITS
          : undefined;
      if (raw[i] === "_" || raw[i] === "^" || unicodeScript) {
        const s = i;
        const direction = unicodeScript === UNICODE_SUBSCRIPT_DIGITS ? "_" : unicodeScript ? "^" : raw[i++];
        let lastIndex = children.length - 1;
        while (lastIndex >= 0 && children[lastIndex].kind === "format")
          lastIndex--;
        const last =
          lastIndex < 0 ? undefined : children.splice(lastIndex, 1)[0];
        let value: MathSemanticNode;
        if (unicodeScript) {
          let digits = "";
          while (i < raw.length && Object.hasOwn(unicodeScript, raw[i]))
            digits += unicodeScript[raw[i++]];
          if (/^[+-]\d+$/.test(digits)) {
            const sign: MathSemanticNode = {
              kind: "symbol", value: digits[0], raw: raw.slice(s, s + 1),
              span: { start: base + s, end: base + s + 1 },
            };
            const number: MathSemanticNode = {
              kind: "number", value: digits.slice(1), raw: raw.slice(s + 1, i),
              span: { start: base + s + 1, end: base + i },
            };
            value = { kind: "sequence", children: [sign, number], ...location(s) };
          } else if (/^\d+$/.test(digits))
            value = { kind: "number", value: digits, ...location(s) };
          else {
            diagnose("math-invalid-unicode-script", s, i, "Unicode script requires digits after an optional sign.");
            value = unknown(s, "invalid Unicode script");
          }
        } else value = argument(depth + 1);
        if (!last) {
          diagnose("math-missing-base", s, i, "Script has no base.");
          children.push(unknown(s, "script without base"));
          continue;
        }
        const field = direction === "_" ? "sub" : "sup";
        if (last.kind === "script" && last[field]) {
          diagnose("math-duplicate-script", s, i, "Repeated script direction.");
          children.push(last, unknown(s, "duplicate script"));
          continue;
        }
        children.push(
          last.kind === "script"
            ? { ...last, [field]: value, ...location(last.span.start - base) }
            : {
                kind: "script",
                base: last,
                [field]: value,
                ...location(last.span.start - base),
              },
        );
        continue;
      }
      const next = atom(depth + 1, false);
      if (
        next.kind === "format" &&
        (next.name === "limits" || next.name === "nolimits") &&
        children.length
      )
        continue;
      children.push(next);
    }
    // Bind scripts first, then join only genuinely adjacent, unscripted Han.
    const joined: MathSemanticNode[] = [];
    for (let j = 0; j < children.length; ) {
      const first = children[j++];
      if (first.kind !== "text" || !/^\p{Script=Han}+$/u.test(first.value)) {
        joined.push(first);
        continue;
      }
      const parts = [first.value];
      let end = first.span.end;
      while (j < children.length) {
        const next = children[j];
        if (
          next.kind !== "text" ||
          next.span.start !== end ||
          !/^\p{Script=Han}+$/u.test(next.value)
        )
          break;
        parts.push(next.value);
        end = next.span.end;
        j++;
      }
      joined.push({
        ...first,
        value: parts.join(""),
        raw: raw.slice(first.span.start - base, end - base),
        span: { start: first.span.start, end },
      });
    }
    return { kind: "sequence", children: joined, ...location(start) };
  };
  const atom = (depth: number, single: boolean): MathSemanticNode => {
    const start = i;
    if (depth > maxDepth) {
      i = raw.length;
      diagnose(
        "math-depth-limit",
        start,
        i,
        "Maximum semantic parse depth exceeded; remainder retained.",
      );
      return unknown(start, "resource limit");
    }
    const char = String.fromCodePoint(raw.codePointAt(i) ?? 32);
    if (char === "{") {
      i++;
      const body = sequence(depth, "}");
      if (raw[i] === "}") i++;
      else
        diagnose(
          "math-unclosed-group",
          start,
          i,
          "Unclosed mathematical group.",
        );
      return { kind: "group", body, ...location(start) };
    }
    if (/[0-9]/.test(char)) {
      i++;
      if (!single) {
        while (/[0-9]/.test(raw[i] ?? "") && i < raw.length) i++;
        if (raw[i] === "." && /[0-9]/.test(raw[i + 1] ?? "")) {
          i++;
          while (/[0-9]/.test(raw[i] ?? "") && i < raw.length) i++;
        } else if (raw[i] === "." && raw.startsWith("\\dot", i + 1)) i++;
      }
      return { kind: "number", value: raw.slice(start, i), ...location(start) };
    }
    if (/[A-Za-z\u0370-\u03ff]/u.test(char)) {
      i += char.length;
      return { kind: "letter", value: char, ...location(start) };
    }
    if (char === "\\") {
      i++;
      const match = /^[A-Za-z]+/.exec(raw.slice(i));
      const name = match ? match[0] : (raw[i] ?? "");
      i += name.length;
      if (FORMATTING.has(name))
        return { kind: "format", name, ...location(start) };
      if (name === "frac" || name === "dfrac" || name === "tfrac") {
        const numerator = argument(depth + 1),
          denominator = argument(depth + 1);
        return { kind: "fraction", numerator, denominator, ...location(start) };
      }
      if (name === "sqrt") {
        white();
        let index: MathSemanticNode | undefined;
        if (raw[i] === "[") {
          i++;
          index = sequence(depth + 1, "]");
          if (raw[i] === "]") i++;
          else
            diagnose(
              "math-unclosed-root-index",
              start,
              i,
              "Missing root index bracket.",
            );
        }
        const body = argument(depth + 1);
        return { kind: "root", body, index, ...location(start) };
      }
      if (name === "text" || name === "mbox") {
        white();
        if (raw[i] === "{") {
          const t = literalGroup();
          return { kind: "text", value: t.value, ...location(t.start, t.end) };
        }
        const body = argument(depth + 1);
        return {
          kind: "text",
          value: body.raw,
          ...location(body.span.start - base),
        };
      }
      if (STYLES.has(name)) {
        const body = argument(depth + 1);
        return { kind: "style", name, body, ...location(start) };
      }
      if (
        [
          "dot",
          "ddot",
          "overline",
          "bar",
          "vec",
          "hat",
          "underline",
          "overrightarrow",
        ].includes(name)
      ) {
        const body = argument(depth + 1);
        return { kind: "accent", name, body, ...location(start) };
      }
      if (name === "ce") {
        literalGroup();
        return {
          kind: "chemistry",
          reason: "Requires chemistry domain encoder.",
          ...location(start),
        };
      }
      if (name === "begin") {
        const env = literalGroup().value;
        if (!ENVIRONMENTS.has(env)) {
          const end = raw.indexOf("\\end{" + env + "}", i);
          i = end < 0 ? raw.length : end + env.length + 6;
          diagnose(
            "math-unsupported-environment",
            start,
            i,
            "Unsupported environment " + env,
          );
          return unknown(start, "unsupported environment");
        }
        const rows: MathSemanticNode[][] = [];
        let row: MathSemanticNode[] = [];
        let cellStart = i;
        let brace = 0;
        let nesting = 0;
        let closed = false;
        const cell = (end: number) => {
          if (depth >= maxDepth) {
            diagnose(
              "math-depth-limit",
              cellStart,
              end,
              "Maximum nested environment depth exceeded.",
            );
            row.push({
              kind: "unknown",
              reason: "resource limit",
              ...location(cellStart, end),
            });
            return;
          }
          const parsed = parseMath(
            raw.slice(cellStart, end),
            { start: base + cellStart, end: base + end },
            { maxDepth: Math.max(1, maxDepth - depth), maxLength },
          );
          diagnostics.push(...parsed.diagnostics);
          row.push(parsed.body);
        };
        while (i < raw.length) {
          if (raw.startsWith("\\begin{", i)) {
            const beginMatch = /^\\begin\{([^}]+)\}/.exec(raw.slice(i));
            if (beginMatch) {
              nesting++;
              i += beginMatch[0].length;
              continue;
            }
          }
          if (raw.startsWith("\\end{", i)) {
            const endMatch = /^\\end\{([^}]+)\}/.exec(raw.slice(i));
            if (nesting && endMatch) {
              nesting--;
              i += endMatch[0].length;
              continue;
            }
            if (endMatch) {
              cell(i);
              rows.push(row);
              if (endMatch[1] !== env)
                diagnose(
                  "math-mismatched-environment",
                  i,
                  i + endMatch[0].length,
                  "Mismatched environment end.",
                );
              i += endMatch[0].length;
              closed = true;
              break;
            }
          }
          if (
            !nesting &&
            brace === 0 &&
            (raw[i] === "&" || raw.startsWith("\\\\", i))
          ) {
            cell(i);
            if (raw[i] === "&") i++;
            else {
              rows.push(row);
              row = [];
              i += 2;
            }
            cellStart = i;
            continue;
          }
          if (raw[i] === "\\") {
            i += Math.min(2, raw.length - i);
            continue;
          }
          if (raw[i] === "{") brace++;
          if (raw[i] === "}") brace--;
          i++;
        }
        if (!closed) {
          cell(i);
          rows.push(row);
          diagnose(
            "math-unclosed-environment",
            start,
            i,
            "Unclosed environment.",
          );
        }
        return { kind: "matrix", environment: env, rows, ...location(start) };
      }
      if (Object.hasOwn(GREEK_COMMANDS, name))
        return {
          kind: "letter",
          value: GREEK_COMMANDS[name],
          ...location(start),
        };
      if (Object.hasOwn(FUNCTIONS, name))
        return { kind: "function", value: name, ...location(start) };
      if (Object.hasOwn(SYMBOLS, name))
        return { kind: "symbol", value: name, ...location(start) };
      diagnose(
        "math-unknown-command",
        start,
        i,
        "Unsupported TeX command \\" + name + "; retained in semantic tree.",
      );
      return unknown(start, "unknown command");
    }
    i += char.length;
    if (char === "→") return {kind:"symbol",value:"rightarrow",...location(start)};
    if (Object.hasOwn(SYMBOLS, char))
      return {
        kind: "symbol",
        value: SYMBOL_ALIASES[char] ?? char,
        ...location(start),
      };
    if (/\p{Script=Han}/u.test(char))
      return { kind: "text", value: char, ...location(start) };
    diagnose(
      "math-unknown-character",
      start,
      i,
      "Unsupported mathematical character " + char,
    );
    return unknown(start, "unknown character");
  };
  if (raw.length > maxLength) {
    i = raw.length;
    diagnose(
      "math-length-limit",
      0,
      i,
      "Maximum input size exceeded; complete source retained.",
    );
    return {
      kind: "math-expression",
      raw,
      span: { start: base, end: base + raw.length },
      body: unknown(0, "resource limit"),
      diagnostics,
    };
  }
  const body = sequence(0);
  return {
    kind: "math-expression",
    raw,
    span: { start: base, end: base + raw.length },
    body,
    diagnostics,
  };
}
