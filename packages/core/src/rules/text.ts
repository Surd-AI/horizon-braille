import type { BrailleCellAtom, Diagnostic, SourceSpan } from "../model";
import {
  analyzeChineseDetailed,
  type ChineseAnalysis,
  type ChineseOverride,
  type ChineseWord,
} from "../language/chinese";
import {
  encodeChineseDetailed,
  PUNCTUATION,
  type ChineseEncodingOptions,
} from "./chinese";
import { braille, DIGITS, LOWER_DIGITS, LATIN_DOTS, SYMBOLS } from "./math-symbols";
export interface TextUnit {
  raw: string;
  span: SourceSpan;
}
export interface TextEncoding {
  atoms: BrailleCellAtom[];
  diagnostics: Diagnostic[];
  unhandled: TextUnit[];
  words: ChineseWord[];
  complete: boolean;
}
export interface TextOptions {
  /** Context-confirmed ratio, including a fullwidth colon in prose. */
  colonMeaning?: (span: SourceSpan) => "ratio" | undefined;
  chinese?: ChineseEncodingOptions;
  overrides?: ChineseOverride[];
  /** Automatic source-bound whole-Han words, in absolute UTF-16 offsets; never manual readings. */
  wordBoundaries?: SourceSpan[];
  /** Transform readings on the existing word partition. Boundaries are separately editable. */
  analyze?: (analysis: ChineseAnalysis) => ChineseAnalysis;
  mathText?: boolean;
}
interface Segment {
  raw: string;
  span: SourceSpan;
  atoms: BrailleCellAtom[];
  word: boolean;
}
/** §5.4.2.4: markers precede words; there is no generic text closing marker. */
export function textWordMarkerDots(index: number, count: number): string[] {
  return count <= 3 || index === count - 1
    ? ["4"]
    : index === 0
      ? ["4", "4"]
      : [];
}
export function encodeText(
  raw: string,
  base = 0,
  options: TextOptions = {},
): TextEncoding {
  let analysis = analyzeChineseDetailed(
    raw,
    (options.overrides ?? []).filter(
      (o) => o.start < base + raw.length && o.end > base,
    ),
    base,
    undefined,
    (options.wordBoundaries ?? []).filter(o => o.start < base + raw.length && o.end > base),
  );
  if (options.analyze) analysis = options.analyze(analysis);
  const result: TextEncoding = {
    atoms: [],
    diagnostics: [...analysis.diagnostics],
    unhandled: [],
    words: analysis.words,
    complete: true,
  };
  const segments: Segment[] = [];
  let serial = 0;
  const atom = (
    cells: string,
    span: SourceSpan,
    ruleId: string,
    extra: Partial<BrailleCellAtom> = {},
  ): BrailleCellAtom => ({
    kind: "cell",
    cells,
    span,
    ruleId,
    group: `text:${base}:${serial++}`,
    breakBefore: false,
    breakAfter: true,
    ...extra,
  });
  const space = (span: SourceSpan, count = 1, preserve = false) =>
    atom(braille(Array(count).fill("0")), span, "GBT44725-2024-4.8", {
      preserveSpace: preserve,
    });
  for (let wi = 0; wi < analysis.words.length; wi++) {
    const word = analysis.words[wi];
    if (word.kind === "chinese") {
      if (wi && analysis.words[wi - 1].kind === "chinese")
        segments.push({
          raw: " ",
          span: { start: word.span.start, end: word.span.start },
          atoms: [space({ start: word.span.start, end: word.span.start })],
          word: false,
        });
      const r = encodeChineseDetailed([word], options.chinese);
      result.diagnostics.push(...r.diagnostics);
      result.unhandled.push(...r.unhandled);
      segments.push({
        raw: word.raw,
        span: word.span,
        atoms: r.atoms,
        word: true,
      });
      continue;
    }
    for (const match of word.raw.matchAll(
      /\d+(?:\.\d+)?|[A-Za-z]+|——|……|[ \t]+|\u3000|./gsu,
    )) {
      let value = match[0];
      const span = {
        start: word.span.start + match.index,
        end: word.span.start + match.index + value.length,
      };
      if (value === "：" && options.colonMeaning?.(span) === "ratio")
        value = ":";
      let encoded: BrailleCellAtom[] = [],
        isWord = false;
      if (PUNCTUATION[value])
        encoded = encodeChineseDetailed(
          [{ ...word, raw: value, span }],
          options.chinese,
        ).atoms;
      else if (/^[\u2460-\u2469]$/u.test(value)) {
        // GF 0019—2018 informative Annex B: an encircled numeral uses the
        // number sign followed by lowered digit cells. Keep it distinct from
        // NFKC-normalized ordinary digits (① must not silently become 1).
        const numeral = value.codePointAt(0)! - 0x2460 + 1;
        encoded = [atom(
          braille(["3456", ...Array.from(String(numeral), digit => LOWER_DIGITS[+digit])]),
          span,
          "GF0019-2018-B",
        )];
        isWord = true;
      }
      else if (/^\d/.test(value)) {
        encoded = [
          atom(
            braille([
              "3456",
              ...Array.from(value, (c) => (c === "." ? "2" : DIGITS[+c])),
            ]),
            span,
            "GBT18028-2010-5.1",
          ),
        ];
        isWord = true;
      } else if (/^[A-Za-z]+$/.test(value)) {
        let type = "";
        const dots: string[] = [];
        for (const c of value) {
          const next = c === c.toLowerCase() ? "56" : "6";
          if (next !== type) dots.push(next);
          dots.push(LATIN_DOTS[c.toLowerCase().charCodeAt(0) - 97]);
          type = next;
        }
        // No guessed English syllable boundaries: a whole foreign word is atomic.
        encoded = [atom(braille(dots), span, "GBT18028-2010-5.2")];
        isWord = true;
      } else if (value === "\u3000") encoded = [space(span, 2, true)];
      else if (/^[ \t]+$/.test(value)) encoded = [space(span, value.length)];
      else if (!options.mathText && Object.hasOwn(SYMBOLS, value)) {
        const rule = SYMBOLS[value];
        encoded = [
          atom(braille(["46", ...rule.dots]), span, "GBT18028-2010-5.4"),
        ];
      } else {
        result.unhandled.push({ raw: value, span });
        result.diagnostics.push({
          code: "text-unhandled",
          severity: "error",
          span,
          message:
            "Source character has no checked prose encoding; retained with a visible placeholder.",
        });
        encoded = [atom(braille(["123456"]), span, "unhandled-placeholder")];
      }
      segments.push({ raw: value, span, atoms: encoded, word: isWord });
    }
  }
  if (options.mathText) {
    // Punctuation ends a consecutive-word run; ordinary whitespace does not.
    for (let begin = 0; begin < segments.length; ) {
      if (!segments[begin].word) {
        begin++;
        continue;
      }
      let end = begin + 1;
      while (
        end < segments.length &&
        (segments[end].word || /^\s+$/u.test(segments[end].raw))
      )
        end++;
      const words = segments.slice(begin, end).filter((s) => s.word);
      words.forEach((segment, index) => {
        const marker = textWordMarkerDots(index, words.length);
        if (marker.length && segment.atoms.length)
          segment.atoms.unshift(
            atom(braille(marker), segment.span, "GBT18028-2010-5.4", {
              group: segment.atoms[0].group,
              textMarker: true,
              breakAfter: false,
            }),
          );
      });
      begin = end;
    }
  }
  const punctuation = (s: Segment | undefined) =>
    !!s && Object.hasOwn(PUNCTUATION, s.raw);
  const open = new Set(["“", "‘", "（", "〔", "【", "《", "〈"]),
    close = new Set(["”", "’", "）", "〕", "】", "》", "〉"]);
  const requiredBlank = (span: SourceSpan) => {
    if (result.atoms.length && !/^\u2800+$/.test(result.atoms.at(-1)!.cells))
      result.atoms.push(space(span));
  };
  segments.forEach((segment, index) => {
    const isSymbol =
      segment.atoms.some((a) => a.ruleId === "GBT18028-2010-5.4") &&
      !options.mathText;
    // This is an inserted layout cell, not a second encoding of the opening
    // bracket or mathematical symbol. Anchor it at the boundary so source
    // mapping remains one-to-one for the actual punctuation cell.
    if (open.has(segment.raw) || isSymbol)
      requiredBlank({ start: segment.span.start, end: segment.span.start });
    if (segment.raw === "·" && result.atoms.length) {
      // §4.8.5 prohibits starting a line with an interpunct.
      const group = result.atoms.at(-1)!.group;
      segment.atoms = segment.atoms.map((a) => ({
        ...a,
        group,
        breakBefore: false,
      }));
    }
    // Coalesce only a synthetic required space with the adjacent ordinary space.
    if (
      /^\s+$/.test(segment.raw) &&
      result.atoms.length &&
      result.atoms.at(-1)!.span.start === result.atoms.at(-1)!.span.end &&
      /^\u2800+$/.test(result.atoms.at(-1)!.cells)
    )
      result.atoms.pop();
    result.atoms.push(...segment.atoms);
    const next = segments[index + 1];
    const after =
      ["，", "、", "；", "："].includes(segment.raw) ||
      (segment.raw === "……" && next && !punctuation(next)) ||
      close.has(segment.raw) ||
      isSymbol;
    if (after && next && !/^\s+$/.test(next.raw))
      requiredBlank({ start: segment.span.end, end: segment.span.end });
  });
  result.complete =
    result.unhandled.length === 0 &&
    !result.diagnostics.some((d) => d.severity !== "info");
  return result;
}
