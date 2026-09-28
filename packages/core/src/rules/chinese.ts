import type { BrailleCellAtom, Diagnostic } from "../model";
import type { ChineseWord, ChineseSyllable } from "../language/chinese";
export const INITIALS: Readonly<Record<string, string>> = Object.freeze({
  b: "12",
  p: "1234",
  m: "134",
  f: "124",
  d: "145",
  t: "2345",
  n: "1345",
  l: "123",
  g: "1245",
  j: "1245",
  k: "13",
  q: "13",
  h: "125",
  x: "125",
  zh: "34",
  ch: "12345",
  sh: "156",
  r: "245",
  z: "1356",
  c: "14",
  s: "234",
});
export const FINALS: Readonly<Record<string, string>> = Object.freeze({
  a: "35",
  o: "26",
  e: "26",
  i: "24",
  u: "136",
  ü: "346",
  er: "1235",
  ai: "246",
  ao: "235",
  ei: "2346",
  ou: "12356",
  ia: "1246",
  iao: "345",
  ie: "15",
  iou: "1256",
  ua: "123456",
  uai: "13456",
  uei: "2456",
  uo: "135",
  üe: "23456",
  an: "1236",
  ang: "236",
  en: "356",
  eng: "3456",
  ian: "146",
  iang: "1346",
  in: "126",
  ing: "16",
  uan: "12456",
  uang: "2356",
  uen: "25",
  ong: "256",
  ueng: "256",
  üan: "12346",
  ün: "456",
  iong: "1456",
});
const TONES = ["", "", "2", "3", "23"];
TONES[1] = "1";
export const PUNCTUATION: Readonly<Record<string, readonly string[]>> =
  Object.freeze(
    Object.fromEntries(
      Object.entries({
        "。": ["5", "23"],
        "，": ["5"],
        "、": ["4"],
        "；": ["56"],
        "？": ["5", "3"],
        "！": ["56", "2"],
        "：": ["36"],
        "“": ["45"],
        "”": ["45"],
        "‘": ["45", "45"],
        "’": ["45", "45"],
        "（": ["56", "3"],
        "）": ["6", "23"],
        "［": ["56", "23"],
        "］": ["56", "23"],
        "——": ["6", "36"],
        "……": ["5", "5", "5"],
        "-": ["36"],
        "《": ["5", "36"],
        "》": ["36", "2"],
        "〈": ["5", "3"],
        "〉": ["6", "2"],
        "·": ["6", "3"],
        "*": ["2356", "35"],
      }).map(([symbol, dots]) => [symbol, Object.freeze(dots)]),
    ),
  );
export function dotsToCells(dots: readonly string[]): string {
  return dots
    .map((d) =>
      String.fromCharCode(
        0x2800 + [...d].reduce((n, c) => n | (1 << (Number(c) - 1)), 0),
      ),
    )
    .join("");
}
const aliases: Record<string, string> = {
  yi: "i",
  ya: "ia",
  ye: "ie",
  yao: "iao",
  you: "iou",
  yan: "ian",
  yin: "in",
  yang: "iang",
  ying: "ing",
  wu: "u",
  wa: "ua",
  wo: "uo",
  wai: "uai",
  wei: "uei",
  wan: "uan",
  wen: "uen",
  wang: "uang",
  weng: "ueng",
  yu: "ü",
  yue: "üe",
  yuan: "üan",
  yun: "ün",
  yong: "iong",
};
export function normalizeSyllable(reading: string) {
  const m = /^([a-züv:]+)([1-5])$/i.exec(reading);
  if (!m) return null;
  const spelling = m[1].toLowerCase().replace(/u:|v/g, "ü");
  const tone = +m[2];
  let initial = "",
    final = aliases[spelling] ?? spelling;
  if (!aliases[spelling]) {
    initial = /^(zh|ch|sh|[bpmfdtnlgkhjqxrzcs])/.exec(spelling)?.[0] ?? "";
    final = spelling.slice(initial.length);
  }
  if (["j", "q", "x"].includes(initial) && final.startsWith("u"))
    final = "ü" + final.slice(1);
  final =
    ({ iu: "iou", ui: "uei", un: "uen" } as Record<string, string>)[final] ??
    final;
  if (!final) return null;
  if (["zhi", "chi", "shi", "ri", "zi", "ci", "si"].includes(spelling))
    final = "";
  if (
    (initial && !INITIALS[initial]) ||
    (final && !FINALS[final]) ||
    (!initial && !final)
  )
    return null;
  return { spelling, initial, final, tone };
}
export interface ChineseEncodingOptions {
  tones?: "normative" | "full";
  contractions?: boolean;
  /** §10.2.8 explicit unresolved sense policy */ unknownSemanticTone?:
    | "retain"
    | "normative";
}
export interface ChineseEncoding {
  atoms: BrailleCellAtom[];
  diagnostics: Diagnostic[];
  /** Exact source units that a downstream text/domain encoder must handle. */ unhandled: ChineseWord[];
}
function syllableDots(
  s: ChineseSyllable,
  next: ChineseSyllable | undefined,
  word: ChineseWord,
  options: ChineseEncodingOptions,
): { dots: string[]; ruleId: string } | null {
  const n = normalizeSyllable(s.reading);
  if (!n) return null;
  const { initial, final, tone, spelling } = n;
  const canonicalReading = spelling + tone;
  const nextN = next && normalizeSyllable(next.reading);
  const vowelNext = !!nextN && !nextN.initial;
  const contract: Record<string, [string, string[]]> = {
    的: ["de5", ["145"]],
    么: ["me5", ["134"]],
    你: ["ni3", ["1345"]],
    他: ["ta1", ["2345"]],
    她: ["ta1", ["2345", "1"]],
    它: ["ta1", ["4", "2345"]],
  };
  if (
    options.contractions !== false &&
    contract[s.raw]?.[0] === canonicalReading &&
    (!vowelNext || s.raw === "她")
  )
    return { dots: [...contract[s.raw][1]], ruleId: "GF0019-2018-11.1" };
  if ((s.raw === "他" || s.raw === "它") && canonicalReading === "ta1")
    return {
      dots: s.raw === "他" ? ["2345", "35"] : ["4", "2345", "35"],
      ruleId: "GF0019-2018-9.4",
    };
  const dots = [
    ...(initial ? [INITIALS[initial]] : []),
    ...(final ? [FINALS[final]] : []),
  ];
  let omit = tone === 5;
  let ruleId = "GF0019-2018-9.1";
  if (options.tones !== "full" && tone !== 5) {
    const retain =
      s.retainTone ||
      options.unknownSemanticTone === "retain" ||
      (s.raw === "问" && canonicalReading === "wen4") ||
      (s.raw === "再" && canonicalReading === "zai4") ||
      (word.raw === "地道" && tone === 4);
    if (retain) ruleId = "GF0019-2018-10.2.8";
    else if (!final && vowelNext) ruleId = "GF0019-2018-10.2.7";
    else {
      if (initial === "f" && tone === 1) {
        omit = true;
        ruleId = "GF0019-2018-10.2.1";
      }
      if (
        ["p", "m", "t", "n", "h", "q", "ch", "r", "c"].includes(initial) &&
        tone === 2 &&
        spelling !== "tou"
      ) {
        omit = true;
        ruleId = "GF0019-2018-10.2.2";
      }
      if (
        ["b", "d", "l", "g", "k", "j", "x", "zh", "sh", "z", "s"].includes(
          initial,
        ) &&
        tone === 4 &&
        !["le", "zi"].includes(spelling)
      ) {
        omit = true;
        ruleId = "GF0019-2018-10.2.3";
      }
      if (!initial && tone === 4) {
        omit = true;
        ruleId = "GF0019-2018-10.2.4";
      }
      if (["yi1", "er2", "wo3", "ye3", "you3"].includes(canonicalReading)) {
        omit = true;
        ruleId = "GF0019-2018-10.2.5";
      }
      if (["yi4", "er4", "wo4", "ye4", "you4"].includes(canonicalReading)) {
        omit = false;
        ruleId = "GF0019-2018-10.2.5";
      }
      if (spelling === "o") {
        omit = true;
        ruleId = "GF0019-2018-10.2.6";
      }
      if (spelling === "e") {
        omit = false;
        ruleId = "GF0019-2018-10.2.6";
      }
    }
  }
  if (!omit && tone !== 5) dots.push(TONES[tone]);
  return { dots, ruleId };
}
export function encodeChineseDetailed(
  words: readonly ChineseWord[],
  options: ChineseEncodingOptions = {},
): ChineseEncoding {
  const atoms: BrailleCellAtom[] = [];
  const diagnostics: Diagnostic[] = [];
  const unhandled: ChineseWord[] = [];
  words.forEach((w, wi) => {
    if (w.kind === "text") {
      let offset = w.span.start;
      for (const match of w.raw.matchAll(/——|……|./gsu)) {
        const raw = match[0],
          span = { start: offset, end: offset + raw.length };
        offset = span.end;
        const dots = PUNCTUATION[raw];
        if (dots)
          atoms.push({
            kind: "cell",
            cells: dotsToCells(dots),
            span,
            ruleId: "GF0019-2018-8",
            group: `punctuation:${span.start}`,
            breakBefore: false,
            breakAfter: true,
          });
        else {
          unhandled.push({ ...w, raw, span, syllables: [] });
          diagnostics.push({
            code: "CHINESE_DOWNSTREAM_TEXT",
            severity: "info",
            span,
            message:
              "Preserved non-Chinese text requires downstream encoding/layout.",
          });
        }
      }
      return;
    }
    if (wi > 0 && words[wi - 1].kind === "chinese")
      atoms.push({
        kind: "cell",
        cells: "⠀",
        span: { start: w.span.start, end: w.span.start },
        ruleId: "GF0019-2018-12.2.1",
        group: `word-space:${w.span.start}`,
        breakBefore: false,
        breakAfter: true,
      });
    w.syllables.forEach((s, i) => {
      const encoded = syllableDots(s, w.syllables[i + 1], w, options);
      if (!encoded) {
        unhandled.push({
          ...w,
          raw: s.raw,
          span: { ...s.span },
          syllables: [{ ...s, candidates: [...s.candidates] }],
        });
        diagnostics.push({
          code: "CHINESE_UNKNOWN_SYLLABLE",
          severity: "error",
          span: { ...s.span },
          message: `Unsupported syllable ${s.reading || s.raw}.`,
        });
        return;
      }
      atoms.push({
        kind: "cell",
        cells: dotsToCells(encoded.dots),
        span: { ...s.span },
        ruleId: encoded.ruleId,
        group: `syllable:${s.span.start}`,
        breakBefore: i > 0,
        breakAfter: true,
        ...(i < w.syllables.length - 1
          ? { continuation: { lineEnd: "", lineStart: dotsToCells(["36"]) } }
          : {}),
      });
    });
  });
  return { atoms, diagnostics, unhandled };
}
/** Throws on unhandled input: use detailed variant for mixed-text routing. */
export function encodeChinese(
  words: readonly ChineseWord[],
  options: ChineseEncodingOptions = {},
): BrailleCellAtom[] {
  const r = encodeChineseDetailed(words, options);
  if (r.unhandled.length)
    throw new Error(
      "Chinese encoding requires downstream handling; use encodeChineseDetailed().",
    );
  return r.atoms;
}
