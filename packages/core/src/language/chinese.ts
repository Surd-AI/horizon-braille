import { pinyin } from "pinyin-pro";
import type { Diagnostic, SourceSpan } from "../model";
import { normalizeManualReading } from "./reading-validation";
import { checkedChineseLexicon } from "./checked-lexicon";
export interface ChineseSyllable {
  raw: string;
  reading: string;
  candidates: string[];
  span: SourceSpan;
  source: "dictionary" | "manual";
  /** Decision provenance is separate from the dictionary/manual candidate origin. */
  resolutionSource?: "manual" | "heuristic" | "api";
  retainTone?: boolean;
}
export interface ChineseWord {
  kind: "chinese" | "text";
  raw: string;
  span: SourceSpan;
  syllables: ChineseSyllable[];
  source: "proposal" | "manual";
  ruleId: string;
}
export interface ChineseOverride extends SourceSpan {
  readings: string[];
  retainTones?: boolean[];
}
export interface ChineseAnalysis {
  words: ChineseWord[];
  diagnostics: Diagnostic[];
}
export type ReadingProvider = (
  text: string,
) => { raw: string; reading: string; candidates: string[] }[];
export const localReadingProvider: ReadingProvider = (text) =>
  pinyin(text, { type: "all", toneType: "num", toneSandhi: false }).map(
    (x) => ({
      raw: x.origin,
      reading: x.pinyin.replace(/0$/, "5"),
      candidates: pinyin(x.origin, {
        type: "array",
        toneType: "num",
        multiple: true,
        toneSandhi: false,
      }).map((r) => r.replace(/0$/, "5")),
    }),
  );
const han = /^\p{Script=Han}+$/u;
// Small editorial vocabulary, not normative GF word-boundary evidence. These
// terms may join only two complete adjacent automatic words; never split a
// larger word to recover a substring (e.g. 这边 or 长相). The braille term keeps
// the immediate ICU preview consistent with the usual HanLP proposal.
const editorialWordProposals = new Set(["边长", "周长", "半径", "直径", "盲文"]);
/** Transport binds these offsets to the document; this checks the pure data contract. */
export function validWordBoundaries(text: string, value: unknown, baseOffset = 0): value is SourceSpan[] {
  if (!Array.isArray(value) || value.length > 10000) return false;
  let end = baseOffset;
  if (!value.every(span => {
    if (!span || typeof span !== "object" || !Number.isInteger(span.start) ||
      !Number.isInteger(span.end) || span.start < end || span.start >= span.end ||
      span.end > baseOffset + text.length ||
      !han.test(text.slice(span.start - baseOffset, span.end - baseOffset))) return false;
    end = span.end;
    return true;
  })) return false;
  // A touched Han run must be partitioned completely, never partly resegmented.
  let proposalIndex = 0;
  for (const run of text.matchAll(/\p{Script=Han}+/gu)) {
    const start = baseOffset + run.index, end = start + run[0].length;
    const spans: SourceSpan[] = [];
    while (proposalIndex < value.length && value[proposalIndex].start < end)
      spans.push(value[proposalIndex++]);
    if (spans.length && (spans[0].start !== start || spans.at(-1)!.end !== end ||
      spans.some((s, i) => i > 0 && spans[i - 1].end !== s.start))) return false;
  }
  return true;
}
/** Compare exact Chinese coverage without trusting an external tokenizer's context. */
export function wordBoundariesCoverWords(spans: SourceSpan[], words: ChineseWord[]): boolean {
  const runs = (items: SourceSpan[]) => {
    const merged: SourceSpan[] = [];
    for (const span of [...items].sort((a,b) => a.start - b.start)) {
      const last = merged.at(-1);
      if (last && span.start <= last.end) last.end = Math.max(last.end, span.end);
      else merged.push({...span});
    }
    return JSON.stringify(merged);
  };
  return runs(spans) === runs(words.filter(w => w.kind === "chinese").map(w => w.span));
}
/** Proposals are editable, not a claim of complete GF §12 grammatical analysis. */
export function analyzeChineseDetailed(
  text: string,
  overrides: ChineseOverride[] = [],
  baseOffset = 0,
  provider: ReadingProvider = localReadingProvider,
  wordBoundaries: SourceSpan[] = [],
): ChineseAnalysis {
  const diagnostics: Diagnostic[] = [];
  const words: ChineseWord[] = [];
  const span = { start: baseOffset, end: baseOffset + text.length };
  const boundaries = new Set<number>([baseOffset]);
  let cursor = baseOffset;
  for (const c of text) {
    cursor += c.length;
    boundaries.add(cursor);
  }
  const valid: ChineseOverride[] = [];
  for (const o of [...overrides].sort((a, b) => a.start - b.start)) {
    const raw = text.slice(o.start - baseOffset, o.end - baseOffset);
    if (
      !Number.isInteger(o.start) ||
      !Number.isInteger(o.end) ||
      !boundaries.has(o.start) ||
      !boundaries.has(o.end) ||
      o.start >= o.end ||
      !han.test(raw) ||
      [...raw].length !== o.readings.length ||
      o.readings.some((r) => !normalizeManualReading(r)) ||
      (o.retainTones && o.retainTones.length !== o.readings.length) ||
      valid.some((v) => v.end > o.start)
    ) {
      diagnostics.push({
        code: "CHINESE_INVALID_OVERRIDE",
        severity: "error",
        span,
        message:
          "Override must cover whole Han characters, with one numbered reading and optional tone flag per character.",
      });
      continue;
    }
    valid.push({ ...o, readings: o.readings.map(r => normalizeManualReading(r)!) });
  }
  function chunk(raw: string, start: number, override?: ChineseOverride) {
    const s = { start, end: start + raw.length };
    if (!han.test(raw)) {
      words.push({
        kind: "text",
        raw,
        span: s,
        syllables: [],
        source: "proposal",
        ruleId: "GF0019-2018-8",
      });
      return;
    }
    let data: ReturnType<ReadingProvider>;
    try {
      data = provider(raw);
    } catch {
      data = [];
    }
    const syllables: ChineseSyllable[] = [];
    let pos = start;
    const chars = [...raw];
    // Provider alignment is checked before accepting any readings.
    const aligned =
      data.length === chars.length &&
      data.every((entry, i) => entry.raw === chars[i]);
    chars.forEach((c, i) => {
      const reading = override?.readings[i] ?? (aligned ? data[i].reading : "");
      const syllable: ChineseSyllable = {
        raw: c,
        reading,
        candidates: aligned ? [...new Set(data[i].candidates)] : [],
        span: { start: pos, end: pos + c.length },
        source: override ? "manual" : "dictionary",
        retainTone: override?.retainTones?.[i],
      };
      if (!reading || !/^[a-züv:]+[1-5]$/i.test(reading))
        diagnostics.push({
          code: "CHINESE_MISSING_READING",
          severity: "error",
          span: syllable.span,
          message: `No aligned numbered reading for ${c}.`,
        });
      else if (!override && syllable.candidates.length > 1)
        diagnostics.push({
          code: "CHINESE_POLYPHONY",
          severity: "warning",
          span: syllable.span,
          message: `Proposed ${reading}; alternatives require contextual review.`,
        });
      syllables.push(syllable);
      pos += c.length;
    });
    words.push({
      kind: "chinese",
      raw,
      span: s,
      syllables,
      source: override ? "manual" : "proposal",
      ruleId: override ? "GF0019-2018-12.2.1" : checkedChineseLexicon[raw]?.ruleId ?? "GF0019-2018-12.2.1",
    });
  }
  const validProposals = validWordBoundaries(text, wordBoundaries, baseOffset);
  if (!validProposals) diagnostics.push({
    code: "CHINESE_INVALID_WORD_BOUNDARIES", severity: "warning", span,
    message: "Automatic word boundaries must be ordered nonoverlapping whole Han ranges; local proposals retained.",
  });
  const proposals = validProposals ? wordBoundaries.filter(p =>
    !valid.some(o => o.start < p.end && o.end > p.start)) : [];
  function propose(raw: string, start: number) {
    // Split Han from other runs first; this retains emoji, digits and Latin exactly.
    for (const m of raw.matchAll(/\p{Script=Han}+|[^\p{Script=Han}]+/gu)) {
      if (!han.test(m[0])) {
        chunk(m[0], start + m.index);
        continue;
      }
      // Only the four directly checked §12.2.4 examples, not generic AABB.
      // Match before ICU so a proposal also works when ICU includes adjacent
      // characters in a larger segment. Manual spans have already partitioned
      // this input; only gaps are proposed here.
      const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });
      const parts: { segment: string; index: number }[] = [];
      const gap = (from: number, to: number) => {
        const local = (a: number, b: number) => {
          for (const p of segmenter.segment(m[0].slice(a, b)))
            parts.push({segment: p.segment, index: a + p.index});
        };
        let cursor = from;
        for (const p of proposals) {
          const a = p.start - start - m.index, b = p.end - start - m.index;
          // A model word crossing a checked AABB example is replaced by the
          // existing local rule; manual spans were already partitioned above.
          if (a < from || b > to) continue;
          local(cursor, a);
          parts.push({segment: m[0].slice(a,b), index:a});
          cursor = b;
        }
        local(cursor, to);
      };
      let end = 0;
      for (const match of m[0].matchAll(/来来往往|说说笑笑|清清楚楚|弯弯曲曲/gu)) {
        gap(end, match.index);
        parts.push({ segment: match[0], index: match.index });
        end = match.index + match[0].length;
      }
      gap(end, m[0].length);
      for (let i = 0; i < parts.length; i++) {
        let value = parts[i].segment;
        const at = start + m.index + parts[i].index;
        // Join only whole proposals, never extract a dictionary substring from
        // a larger word (艺术 / 家乡 must not become 艺术家 / 乡).
        let joined = value;
        let checkedEnd = i;
        for (let j = i + 1; j < parts.length; j++) {
          joined += parts[j].segment;
          if ([...joined].length > 4) break;
          if (checkedChineseLexicon[joined]) checkedEnd = j;
        }
        while (i < checkedEnd) value += parts[++i].segment;
        if (
          i + 1 < parts.length &&
          editorialWordProposals.has(value + parts[i + 1].segment)
        )
          value += parts[++i].segment;
        // §12.2.4 monosyllabic repetition; §12.2.5 plural suffix.
        while (
          i + 1 < parts.length &&
          ((([...value].length === 1 || /^(.)(\1)+$/u.test(value)) &&
            parts[i + 1].segment === [...value][0]) ||
            parts[i + 1].segment === "们")
        )
          value += parts[++i].segment;
        // §12.2.4 repeated disyllabic words remain separate, even if ICU joined them.
        if ([...value].length === 4 && value.slice(0, 2) === value.slice(2)) {
          chunk(value.slice(0, 2), at);
          chunk(value.slice(2), at + 2);
        } else chunk(value, at);
      }
    }
  }
  cursor = baseOffset;
  for (const o of valid) {
    propose(text.slice(cursor - baseOffset, o.start - baseOffset), cursor);
    chunk(text.slice(o.start - baseOffset, o.end - baseOffset), o.start, o);
    cursor = o.end;
  }
  propose(text.slice(cursor - baseOffset), cursor);
  if (words.some((w) => w.kind === "chinese" && w.source === "proposal"))
    diagnostics.push({
      code: "CHINESE_JOIN_PROPOSAL",
      severity: "info",
      span,
      message:
        proposals.length
          ? "Word boundaries include externally supplied editable proposals with existing bounded repetition/suffix rules; manual spans take priority. Not complete grammatical analysis."
          : "Word boundaries are editable ICU proposals with limited GF repetition/suffix rules and a small editorial vocabulary; not complete grammatical analysis.",
      ruleId: "GF0019-2018-12",
    });
  return { words, diagnostics };
}
/** Use detailed variant to collect analysis diagnostics. No global mutable state. */
export function analyzeChinese(
  text: string,
  overrides: ChineseOverride[] = [],
  baseOffset = 0,
): ChineseWord[] {
  return analyzeChineseDetailed(text, overrides, baseOffset).words;
}
