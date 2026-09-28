import {
  encodeDocument,
  type EncodedDocument,
  type ConvertOptions,
} from "./convert";
import type { Diagnostic, SourceSpan } from "./model";
import { encodeText } from "./rules/text";
import { parseMath, simpleMappingColon } from "./parser/math";
import { encodeMath } from "./rules/math";
import { checkedChineseLexicon } from "./language/checked-lexicon";

export type AmbiguityKind =
  | "colon"
  | "polyphone"
  | "slash"
  | "minus"
  | "element";
export interface Ambiguity {
  id: string;
  kind: AmbiguityKind;
  span: SourceSpan;
  candidates: { id: string; description: string }[];
  context: string;
  /** Exact target in context, using UTF-16 offsets; required for provider calls. */
  contextTarget?: SourceSpan & { text: string };
  /** Existing segmented word, only when fully contained in the bounded context. */
  contextWord?: SourceSpan & { text: string };
  tokenSpan?: SourceSpan;
  /** True only for a colon inside a parsed plain-text node. */
  plainText?: boolean;
  /** Exact checked f:A→B syntax inside one mathematical node. */
  mappingSyntax?: boolean;
  /** Plain-text node containing a reading target; excludes formula scopes. */
  textSpan?: SourceSpan;
}
export interface Resolution {
  id: string;
  choice: string;
  source: "manual" | "heuristic" | "api";
  probabilities?: Record<string, number>;
  confidence?: number;
}
export interface DecisionSet {
  documentSource: string;
  resolutions: Resolution[];
  /** Optional reusable local failure state, never remote messages or bodies. */
  fallbackCodes?: string[];
}
const FALLBACK_CODES = new Set([
  "provider-unconfigured",
  "provider-cancelled",
  "provider-failed",
  "provider-timeout",
  "provider-network-error",
  "provider-invalid-request",
  "provider-invalid-config",
  "provider-request-too-large",
  "provider-response-too-large",
  "provider-invalid-response",
  "provider-invalid-json",
  "ambiguity-budget",
  "ambiguity-invalid-answer",
  "ambiguity-low-confidence",
  "ambiguity-low-confidence-or-rule-conflict",
]);
export function isFallbackCode(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (FALLBACK_CODES.has(value) || /^provider-http-[45]\d{2}$/.test(value))
  );
}
function uniqueDecisions(resolutions: readonly Resolution[]) {
  const byId = new Map<string, Resolution>(),
    duplicates = new Set<string>();
  for (const r of resolutions) {
    if (byId.has(r.id) || duplicates.has(r.id)) {
      byId.delete(r.id);
      duplicates.add(r.id);
    } else byId.set(r.id, r);
  }
  return { byId, duplicates };
}
export interface TransportTrace {
  requestSent: boolean | "unknown";
  service?: string;
  model?: string;
  reasoning?: false;
  durationMs?: number;
  outcome: string;
  questions?: Record<string, { type: string; instructions: string; criteria: Record<string, string> }>;
}
export interface DecisionAudit {
  transport: TransportTrace;
  totalQuestions: number;
  omittedQuestions: number;
  questions: (Ambiguity & { model?: Resolution; accepted?: Resolution; adopted: boolean; outcome: string })[];
}
function copyTrace(value: TransportTrace | undefined): TransportTrace {
  const fallback: TransportTrace = { requestSent: "unknown", outcome: "transport-unknown" };
  if (!value) return fallback;
  try {
    const trace: TransportTrace = {
      requestSent: typeof value.requestSent === "boolean" ? value.requestSent : "unknown",
      outcome: typeof value.outcome === "string" && value.outcome.length <= 80 ? value.outcome : "transport-unknown",
    };
    if (typeof value.service === "string" && value.service.length <= 80) trace.service = value.service;
    if (value.reasoning === false) trace.reasoning = false;
    if (typeof value.model === "string" && value.model.length <= 80) trace.model = value.model;
    if (Number.isFinite(value.durationMs) && value.durationMs! >= 0) trace.durationMs = value.durationMs;
    if (value.questions && Object.keys(value.questions).length <= 64) {
      const questions: NonNullable<TransportTrace["questions"]> = {};
      for (const [id, q] of Object.entries(value.questions)) {
        if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || typeof q.instructions !== "string" || q.instructions.length > 131072 || Object.keys(q.criteria).length > 32) return fallback;
        const criteria: Record<string, string> = {};
        for (const [key, description] of Object.entries(q.criteria)) {
          if (!/^[a-zA-Z0-9_ü:-]{1,40}$/.test(key) || typeof description !== "string" || description.length > 512) return fallback;
          criteria[key] = description;
        }
        questions[id] = { type: "choice", instructions: q.instructions, criteria };
      }
      if (JSON.stringify(questions).length > 131072) return fallback;
      trace.questions = questions;
    }
    return trace;
  } catch { return fallback; }
}
function copyResolution(r: Resolution): Resolution {
  return { id: r.id, choice: r.choice, source: r.source,
    ...(r.probabilities ? { probabilities: { ...r.probabilities } } : {}),
    ...(r.confidence !== undefined ? { confidence: r.confidence } : {}) };
}
export interface ProviderResult {
  trace?: TransportTrace;
  resolutions: Resolution[];
  diagnostics: Diagnostic[];
}
export type AmbiguityProvider = (
  questions: readonly Ambiguity[],
  signal?: AbortSignal,
) => Promise<ProviderResult>;
export interface ResolutionSet extends DecisionSet {
  audit?: DecisionAudit;
  ambiguities: Ambiguity[];
  diagnostics: Diagnostic[];
}
export interface DecisionProgress {completed:number;total:number;localResolved?:number;resolutions?:Resolution[];reviewedIds?:string[]}
export interface ResolveOptions extends ConvertOptions {
  batchSize?: number;
  timeBudgetMs?: number;
  /** Online application policy: ask the model about all non-manual targets in bounded batches. */
  modelFirst?: boolean;
  processAll?: boolean;
  onProgress?: (progress: DecisionProgress) => void;
  provider?: AmbiguityProvider;
  manual?: DecisionSet;
  signal?: AbortSignal;
}
export interface SemanticOptions extends ConvertOptions {
  /** Confirmed plain-prose clocks default to explicit hours/minutes expansion. */
  timePolicy?: "preserve" | "normalize-hours-minutes";
}
export const ambiguityDiagnostic = (
  code: string,
  span: SourceSpan = { start: 0, end: 0 },
  severity: Diagnostic["severity"] = "warning",
): Diagnostic => ({ code, span, severity, message: code.replaceAll("-", " ") });
// IDs are transport labels; the exact documentSource binding below is the stale-edit guard.
function fingerprint(source: string): string {
  let h = 2166136261;
  for (let i = 0; i < source.length; i++)
    h = Math.imul(h ^ source.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}
function splitsScalar(source: string, at: number): boolean {
  return (
    /[\uD800-\uDBFF]/.test(source[at - 1] ?? "") &&
    /[\uDC00-\uDFFF]/.test(source[at] ?? "")
  );
}
export function validContextTarget(a: Ambiguity): boolean {
  const t = a.contextTarget;
  return (
    !!t &&
    typeof a.context === "string" &&
    Number.isInteger(t.start) &&
    Number.isInteger(t.end) &&
    t.start >= 0 &&
    t.end > t.start &&
    t.end <= a.context.length &&
    typeof t.text === "string" &&
    a.context.slice(t.start, t.end) === t.text &&
    !splitsScalar(a.context, t.start) &&
    !splitsScalar(a.context, t.end) &&
    !!a.span &&
    Number.isInteger(a.span.start) &&
    Number.isInteger(a.span.end) &&
    a.span.start >= t.start &&
    a.span.end - a.span.start === t.end - t.start &&
    (a.kind !== "colon" || /^[:：]$/.test(t.text)) &&
    (a.kind !== "slash" || t.text === "/") &&
    (a.contextWord === undefined || (
      !!a.contextWord && a.kind === "polyphone" &&
      Number.isInteger(a.contextWord.start) && Number.isInteger(a.contextWord.end) &&
      a.contextWord.start >= 0 && a.contextWord.start <= t.start &&
      a.contextWord.end >= t.end && a.contextWord.end <= a.context.length &&
      a.context.slice(a.contextWord.start, a.contextWord.end) === a.contextWord.text &&
      !splitsScalar(a.context, a.contextWord.start) &&
      !splitsScalar(a.context, a.contextWord.end)
    ))
  );
}
function context(
  source: string,
  span: SourceSpan,
  wordSpan?: SourceSpan,
): Pick<Ambiguity, "context" | "contextTarget" | "contextWord"> {
  let start = Math.max(0, span.start - 48),
    end = Math.min(source.length, span.end + 48);
  // Crop inward instead of emitting half a supplementary scalar.
  if (splitsScalar(source, start)) start++;
  if (splitsScalar(source, end)) end--;
  const left = source
    .slice(start, span.start)
    .split(/[;；。！？\r\n]/)
    .at(-1)!;
  const right = source.slice(span.end, end).split(/[;；。！？\r\n]/)[0];
  const text = source.slice(span.start, span.end);
  const contextStart = span.start - left.length;
  const contextEnd = span.end + right.length;
  return {
    context: left + text + right,
    contextTarget: { start: left.length, end: left.length + text.length, text },
    ...(wordSpan && wordSpan.start >= contextStart && wordSpan.end <= contextEnd
      ? { contextWord: {
        start: wordSpan.start - contextStart,
        end: wordSpan.end - contextStart,
        text: source.slice(wordSpan.start, wordSpan.end),
      } } : {}),
  };
}
export function collectAmbiguities(
  input: string | EncodedDocument,
  options: ConvertOptions = {},
): Ambiguity[] {
  const encoded =
      typeof input === "string" ? encodeDocument(input, options) : input,
    source = encoded.document.source,
    prefix = fingerprint(source),
    result: Ambiguity[] = [];
  const atomSpans = new Set(
    encoded.atoms
      .filter((a) => a.kind === "cell")
      .map((a) => `${a.span.start}:${a.span.end}`),
  );
  const chains = [...source.matchAll(/[+\-−]?\d+(?:\.\d+)?(?:[:：][+\-−]?\d+(?:\.\d+)?)+/g)];
  const mappingStarts = new Set(encoded.document.nodes.flatMap(n => {
    if (!["inline-math","display-math","bare-math"].includes(n.kind) || !("content" in n)) return [];
    const span = simpleMappingColon(parseMath(n.content,n.contentSpan).body);
    return span ? [span.start] : [];
  }));
  let chainIndex = 0;
  for (const m of source.matchAll(/[:：]/g)) {
    const span = { start: m.index, end: m.index + 1 };
    // TeX command spelling / opaque unparsed input is not a supported semantic scope.
    if (!atomSpans.has(`${span.start}:${span.end}`)) continue;
    while (chainIndex < chains.length && chains[chainIndex].index + chains[chainIndex][0].length <= span.start) chainIndex++;
    const current = chains[chainIndex];
    const chain = current && current.index < span.start && current.index + current[0].length > span.end ? current : undefined;
    if (chain && chain.index + chain[0].search(/[:：]/) !== span.start) continue;
    result.push({
      id: `${prefix}_colon_${span.start}`,
      kind: "colon",
      span,
      mappingSyntax: mappingStarts.has(span.start),
      plainText: encoded.document.nodes.some(n => n.kind === "text" && n.span.start <= span.start && n.span.end >= span.end),
      ...context(source, span),
      tokenSpan:
        chain
          ? { start: chain.index, end: chain.index + chain[0].length }
          : undefined,
      candidates: [
        { id: "time", description: "Clock time hours:minutes[:seconds]" },
        { id: "duration", description: "Elapsed duration hours:minutes[:seconds], not a clock time" },
        { id: "duration-ms", description: "Elapsed duration minutes:seconds, not hours:minutes" },
        { id: "ratio", description: "Mathematical ratio" },
        { id: "punctuation", description: "Prose colon punctuation" },
        {
          id: "mapping",
          description: "Mapping/type relation; needs checked encoding",
        },
        {
          id: "unknown",
          description:
            "Uncertain or conflicting context; request manual review",
        },
      ],
    });
  }
  // Only a complete, short numeric slash expression in a plain-text node is
  // eligible. Dates, paths, word-internal slashes and compound calculations
  // need their own semantics; guessing a fraction there changes the document.
  for (const m of source.matchAll(/\d{1,6}\/\d{1,6}/g)) {
    const tokenSpan = { start: m.index, end: m.index + m[0].length };
    const before = source[tokenSpan.start - 1] ?? "";
    const after = source[tokenSpan.end] ?? "";
    if (/[A-Za-z0-9_./\\:+\-−]/.test(before) || /[A-Za-z0-9_./\\:+\-−]/.test(after)) continue;
    const slash = tokenSpan.start + m[0].indexOf("/");
    const span = { start: slash, end: slash + 1 };
    if (!atomSpans.has(`${span.start}:${span.end}`) ||
      !encoded.document.nodes.some(n => n.kind === "text" && n.span.start <= tokenSpan.start && n.span.end >= tokenSpan.end)) continue;
    result.push({
      id: `${prefix}_slash_${span.start}`, kind: "slash", span, tokenSpan,
      plainText: true, ...context(source, span),
      candidates: [
        { id: "fraction", description: "A printed numeric slash fraction; use the checked mathematical slash encoding" },
        { id: "unknown", description: "Date, path, prose separator or uncertain meaning; retain source for review" },
      ],
    });
  }
  for (const word of encoded.metadata.chineseWords)
    for (const s of word.syllables) {
      if (s.source === "manual" || s.candidates.length < 2) continue;
      result.push({
        id: `${prefix}_polyphone_${s.span.start}`,
          kind: "polyphone",
          span: s.span,
          textSpan: encoded.document.nodes.find(n => n.kind === "text" && n.span.start <= s.span.start && n.span.end >= s.span.end)?.span,
        ...context(source, s.span, word.span),
        candidates: [
          ...s.candidates.map((id) => ({
            id,
            description: `Reading ${id} for ${s.raw}`,
          })),
          {
            id: "unknown",
            description: "Uncertain reading; preserve proposal for review",
          },
        ],
      });
    }
  return result;
}
// Editorial modern-Mandarin lexical exceptions, corroborating the existing
// pinyin-pro whole-word proposals. This is not a general confidence promotion:
// 知's zhi4 (智) literary use and 行's other readings do not apply in these words.
const fixedWordReadings: Readonly<Record<string, readonly string[]>> = {
  银行: ["yin2", "hang2"],
  通知: ["tong1", "zhi1"],
  会议: ["hui4", "yi4"],
};
function grammar(a: Ambiguity, source: string): string | undefined {
  if (a.kind === "polyphone") {
    if (!validContextTarget(a) || !a.contextWord) return;
    // Dispatching a notice, only at a phrase start or after the checked subject
    // 银行. Requiring the standalone verb avoids 头发/理发 and substring guesses.
    if (a.contextWord.text === "发" && a.textSpan && a.span.end + 2 <= a.textSpan.end &&
      source.slice(a.span.start, a.span.end + 2) === "发通知" &&
      /(?:^|银行|[\s，。；：！？])$/.test(source.slice(a.textSpan.start, a.span.start)) &&
      a.candidates.some(c => c.id === "fa1")) return "fa1";
    const readings = fixedWordReadings[a.contextWord.text] ?? checkedChineseLexicon[a.contextWord.text]?.readings;
    const at = [...a.context.slice(a.contextWord.start, a.contextTarget!.start)].length;
    const choice = readings?.[at];
    return choice && a.candidates.some(c => c.id === choice) ? choice : undefined;
  }
  if (a.kind === "slash") {
    if (!validContextTarget(a) || !a.tokenSpan) return "unknown";
    const left = source.slice(Math.max(0, a.tokenSpan.start - 24), a.tokenSpan.start)
      .split(/[，,；;。！？\r\n]/).at(-1)!;
    return /(?:分数|斜分式)\s*[:：]?\s*$/.test(left) ? "fraction" : undefined;
  }
  if (a.kind !== "colon") return;
  if (!validContextTarget(a)) return "unknown";
  if (a.mappingSyntax) return "mapping";
  const t = a.contextTarget!;
  const left = a.context.slice(0, t.start).split(/[,，]/).at(-1)!;
  const right = a.context.slice(t.end).split(/[,，]/)[0];
  const local = left + t.text + right;
  // Explicit prose introduction, before inspecting time/ratio words later in
  // the sentence. Never classify a numeric pair or a mathematical node this way.
  if (a.plainText && !a.tokenSpan && /(?:通知|宣布|说明|提醒|说道|表示)\s*$/.test(left) && /^\s*\p{Script=Han}/u.test(right))
    return "punctuation";
  if (/比分/.test(local)) return "unknown";
  const duration = /时长|持续|耗时|用时/.test(local);
  const time = /会议|开会|时间|时刻|点钟|时分/.test(local),
    ratio = /比例|比值|配比/.test(local);
  if ((time && ratio) || (duration && ratio)) return "unknown";
  if (
    !a.tokenSpan &&
    /(?:会议|开会|时间|时刻|点钟|时分|时长|持续|耗时|用时|比例|比值|配比)\s*$/.test(left) &&
    /^\s*[+\-−]?\d+(?:\.\d+)?[:：][+\-−]?\d+/.test(right)
  )
    return "punctuation";
  if (duration) {
    const fields = a.tokenSpan ? source.slice(a.tokenSpan.start,a.tokenSpan.end).split(/[:：]/).length : 0;
    if (/分秒/.test(local) && !/时分/.test(local))
      return fields === 2 && validTime(a,source,true) ? "duration-ms" : "unknown";
    if (fields === 3 || /时分/.test(local)) return validTime(a, source, true) ? "duration" : "unknown";
    return "unknown";
  }
  if (time) return validTime(a, source) ? "time" : "unknown";
  if (ratio && a.tokenSpan) return "ratio";
}
function validTime(a: Ambiguity, source: string, duration = false): boolean {
  if (!a.tokenSpan) return false;
  if (
    (/[:：.\d+\-−]/.test(source[a.tokenSpan.start - 1] ?? "") &&
      !/(?:会议|开会|时间|时刻|点钟|时分|时长|持续|耗时|用时)\s*[:：]$/.test(
        source.slice(0, a.tokenSpan.start),
      )) ||
    /[:：.\d+\-−]/.test(source[a.tokenSpan.end] ?? "")
  )
    return false;
  const m = /^(\d{1,6})[:：](\d{2})(?:[:：](\d{2}))?$/.exec(
    source.slice(a.tokenSpan.start, a.tokenSpan.end),
  );
  return !!m && (duration || (m[1].length <= 2 && +m[1] < 24)) && +m[2] < 60 && (m[3] === undefined || +m[3] < 60);
}
export function validateResolution(a: Ambiguity, r: Resolution): boolean {
  if (
    !r ||
    !["manual", "heuristic", "api"].includes(r.source) ||
    r.id !== a.id ||
    !a.candidates.some((c) => c.id === r.choice)
  )
    return false;
  if (
    r.confidence !== undefined &&
    (!Number.isFinite(r.confidence) || r.confidence < 0 || r.confidence > 1)
  )
    return false;
  if (r.probabilities !== undefined) {
    if (
      !r.probabilities ||
      typeof r.probabilities !== "object" ||
      Array.isArray(r.probabilities)
    )
      return false;
    const entries = Object.entries(r.probabilities);
    if (
      entries.length !== a.candidates.length ||
      entries.some(
        ([k, v]) =>
          !a.candidates.some((c) => c.id === k) ||
          !Number.isFinite(v) ||
          v < 0 ||
          v > 1,
      )
    )
      return false;
    if (Math.abs(entries.reduce((n, [, v]) => n + v, 0) - 1) > 0.02)
      return false;
  }
  return true;
}
// Explicit confidence is authoritative; use selected probability only when absent.
// Callers validate the complete answer before applying the inclusive 0.5 threshold.
function confident(r: Resolution): boolean {
  return (r.confidence ?? r.probabilities?.[r.choice] ?? 0) >= 0.5;
}
export async function resolveAmbiguities(
  source: string,
  options: ResolveOptions = {},
): Promise<ResolutionSet> {
  const ambiguities = collectAmbiguities(source, options),
    resolutions: Resolution[] = [],
    diagnostics: Diagnostic[] = [],
    pending: Ambiguity[] = [];
  let trace: TransportTrace = { requestSent: false, outcome: "local-only" };
  const modelAnswers = new Map<string, Resolution>();
  const manual =
    options.manual?.documentSource === source ? options.manual.resolutions : [];
  const { byId: manualById, duplicates } = uniqueDecisions(manual);
  if (options.manual && options.manual.documentSource !== source)
    diagnostics.push(ambiguityDiagnostic("ambiguity-stale"));
  for (const a of ambiguities) {
    if (duplicates.has(a.id)) {
      diagnostics.push(
        ambiguityDiagnostic("ambiguity-duplicate-resolution", a.span),
      );
      continue;
    }
    const m = manualById.get(a.id);
    if (m?.source === "manual" && validateResolution(a, m)) {
      resolutions.push({ ...m, source: "manual" });
      continue;
    }
    if (m && !validateResolution(a, m))
      diagnostics.push(ambiguityDiagnostic("ambiguity-invalid-manual", a.span));
    const choice = grammar(a, source);
    if (choice && !(options.modelFirst && options.provider)) {
      resolutions.push({ id: a.id, choice, source: "heuristic" });
      continue;
    }
    pending.push(a);
  }
  if (pending.length > 64 && !options.processAll)
    diagnostics.push(ambiguityDiagnostic("ambiguity-budget"));
  const batch = options.processAll ? pending : pending.slice(0, 64);
  const progress = (completed:number, accepted:Resolution[]=[], reviewedIds:string[]=[]) => { try { options.onProgress?.({completed,total:batch.length,localResolved:resolutions.filter(r=>r.source==='heuristic' && r.choice!=='unknown').length,resolutions:accepted,reviewedIds}); } catch { /* UI observers cannot alter decisions. */ } };
  progress(0);
  if (batch.length && options.provider && !options.signal?.aborted) {
    try {
      trace = { requestSent: "unknown", outcome: "provider-failed" };
      const response: ProviderResult = {resolutions:[],diagnostics:[]};
      const started = performance.now();
      let sent = false, completed = 0;
      const size = Math.min(64,Math.max(1,Math.trunc(options.batchSize || 64)));
      const budget = Math.min(120000,Math.max(1000,options.timeBudgetMs || 45000));
      for (let offset=0; offset<batch.length; offset+=size) {
        if (options.signal?.aborted || performance.now()-started > budget) {
          response.diagnostics.push(ambiguityDiagnostic(options.signal?.aborted ? 'provider-cancelled' : 'ambiguity-budget')); break;
        }
        let part: ProviderResult;
        try {part = await options.provider(batch.slice(offset,offset+size), options.signal);}
        catch {part={resolutions:[],diagnostics:[ambiguityDiagnostic('provider-failed')],trace:{requestSent:'unknown',outcome:'provider-failed'}};}
        const answered = batch.slice(offset,offset+size).flatMap(q => {const matches=part.resolutions.filter(r=>r.id===q.id);return matches.length===1 && validateResolution(q,matches[0]) ? [matches[0]] : [];});
        completed += answered.length;
        if (!options.signal?.aborted) progress(completed,answered.filter(r=>r.choice!=='unknown' && confident(r)).map(r=>({...copyResolution(r),source:'api'})),answered.map(r=>r.id));
        response.resolutions.push(...part.resolutions); response.diagnostics.push(...part.diagnostics);
        sent ||= part.trace?.requestSent === true;
        response.trace = part.trace;
        if (part.diagnostics.some(d=>/^provider-/.test(d.code))) break;
      }
      if(response.trace) response.trace={...response.trace,requestSent:sent || response.trace.requestSent,durationMs:performance.now()-started};
      trace = copyTrace(response.trace);
      for (const a of batch) {
        const answers = response.resolutions.filter(r => r.id === a.id);
        if (answers.length === 1 && validateResolution(a, answers[0]))
          modelAnswers.set(a.id, copyResolution(answers[0]));
      }
      if (options.signal?.aborted) {
        diagnostics.push(ambiguityDiagnostic("provider-cancelled"));
        response.resolutions = [];
      }
      diagnostics.push(...response.diagnostics);
      for (const a of batch) {
        const matches = response.resolutions.filter((r) => r.id === a.id),
          r = matches[0];
        if (matches.length !== 1 || !validateResolution(a, r)) {
          diagnostics.push(
            ambiguityDiagnostic("ambiguity-invalid-answer", a.span),
          );
          continue;
        }
        // Semantic adoption is separate from the encoder's scope/range checks.
        if (
          r.choice !== "unknown" && !confident(r)
        ) {
          diagnostics.push(
            ambiguityDiagnostic(
              "ambiguity-low-confidence",
              a.span,
            ),
          );
          continue;
        }
        resolutions.push({ ...r, source: "api" });
      }
    } catch {
      diagnostics.push(ambiguityDiagnostic("provider-failed"));
    }
  } else if (batch.length)
    diagnostics.push(
      ambiguityDiagnostic(
        options.signal?.aborted
          ? "provider-cancelled"
          : "provider-unconfigured",
      ),
    );
  if (batch.length && !options.provider) trace.outcome = "provider-unconfigured";
  if (options.signal?.aborted) trace.outcome = "provider-cancelled";
  const resolvedIds = new Set(
    resolutions.filter((r) => r.choice !== "unknown").map((r) => r.id),
  );
  for (const a of ambiguities)
    if (!resolvedIds.has(a.id))
      diagnostics.push(ambiguityDiagnostic("ambiguity-pending", a.span));
  const fallbackCodes = [
    ...new Set(diagnostics.map((d) => d.code).filter(isFallbackCode)),
  ];
  const included = [...batch.slice(0,64), ...ambiguities.filter(a => !batch.includes(a)).slice(0, 64)];
  const audit: DecisionAudit = {
    transport: trace, totalQuestions: ambiguities.length,
    omittedQuestions: ambiguities.length - included.length,
    questions: included.map(a => {
      const accepted = resolutions.find(r => r.id === a.id), model = modelAnswers.get(a.id);
      const adopted = !!accepted && accepted.choice !== "unknown";
      const outcome = accepted ? accepted.choice === "unknown" ? "unknown" : accepted.source
        : !options.processAll && pending.indexOf(a) >= 64 ? "ambiguity-budget"
        : options.signal?.aborted ? "provider-cancelled"
        : diagnostics.find(d => d.span.start === a.span.start && d.span.end === a.span.end && d.code !== "ambiguity-pending")?.code ?? trace.outcome;
      return { ...structuredClone(a), model, accepted: accepted && copyResolution(accepted), adopted, outcome };
    }),
  };
  return {
    audit,
    documentSource: source,
    ambiguities,
    resolutions,
    diagnostics,
    ...(fallbackCodes.length ? { fallbackCodes } : {}),
  };
}
export function convertWithResolutions(
  source: string,
  set: DecisionSet & { diagnostics?: Diagnostic[] },
  options: SemanticOptions = {},
): EncodedDocument {
  const initial = encodeDocument(source, options),
    ambiguities = collectAmbiguities(initial),
    stale = set.documentSource !== source;
  const decisions = new Map<string, Resolution>();
  const { byId: suppliedById, duplicates } = uniqueDecisions(set.resolutions);
  const diagnostics: Diagnostic[] = stale
    ? [ambiguityDiagnostic("ambiguity-stale")]
    : [...(set.diagnostics ?? [])];
  if (!stale)
    for (const code of set.fallbackCodes ?? []) {
      if (isFallbackCode(code) && !diagnostics.some((d) => d.code === code))
        diagnostics.push(ambiguityDiagnostic(code));
    }
  for (const a of ambiguities) {
    if (!stale && duplicates.has(a.id))
      diagnostics.push(
        ambiguityDiagnostic("ambiguity-duplicate-resolution", a.span),
      );
    const r = stale ? undefined : suppliedById.get(a.id),
      fixed = grammar(a, source);
    if (
      r &&
      validateResolution(a, r) &&
      r.choice !== "unknown" &&
      (r.source !== "heuristic" || !fixed || fixed === r.choice) &&
      (r.source !== "api" || confident(r))
    )
      decisions.set(a.id, r);
    else diagnostics.push(ambiguityDiagnostic("ambiguity-pending", a.span));
  }
  const resolvedSpans = new Set(
    ambiguities
      .filter((a) => a.kind === "polyphone" && decisions.has(a.id))
      .map((a) => `${a.span.start}:${a.span.end}`),
  );
  const readingBySpan = new Map(
    ambiguities
      .filter((a) => a.kind === "polyphone")
      .map((a) => [`${a.span.start}:${a.span.end}`, a]),
  );
  const ratioSpans = new Set(
    ambiguities
      .filter(
        (a) => a.kind === "colon" && decisions.get(a.id)?.choice === "ratio",
      )
      .flatMap((a) => a.tokenSpan
        ? [...source.slice(a.tokenSpan.start,a.tokenSpan.end).matchAll(/[:：]/g)].map(m => `${a.tokenSpan!.start+m.index}:${a.tokenSpan!.start+m.index+1}`)
        : [`${a.span.start}:${a.span.end}`]),
  );
  const acceptedMappings = new Set(ambiguities.filter(a => a.mappingSyntax && decisions.get(a.id)?.choice === "mapping").map(a=>a.span.start));
  const result = encodeDocument(source, {
    ...options,
    mappingAllowed: span => acceptedMappings.has(span.start),
    colonMeaning: (span) =>
      ratioSpans.has(`${span.start}:${span.end}`) ? "ratio" : undefined,
    analyze: (analysis) => {
      const base = options.analyze ? options.analyze(analysis) : analysis;
      return {
        ...base,
        words: base.words.map((w) => ({
          ...w,
          syllables: w.syllables.map((s) => {
            const a = readingBySpan.get(`${s.span.start}:${s.span.end}`),
              r = a && decisions.get(a.id);
            return r && s.source !== "manual"
              ? { ...s, reading: r.choice, resolutionSource: r.source }
              : s;
          }),
        })),
        diagnostics: base.diagnostics.filter(
          (d) =>
            !(
              d.code === "CHINESE_POLYPHONY" &&
              resolvedSpans.has(`${d.span.start}:${d.span.end}`)
            ),
        ),
      };
    },
  });
  let recoveredBareFraction = false;
  for (const a of ambiguities.filter(a => a.kind === "slash" && decisions.get(a.id)?.choice === "fraction")) {
    const span = a.tokenSpan;
    if (!span || !a.plainText || !/^[0-9]{1,6}\/[0-9]{1,6}$/.test(source.slice(span.start, span.end))) {
      diagnostics.push(ambiguityDiagnostic("ambiguity-fraction-scope-unsupported", a.span));
      continue;
    }
    const affected = result.atoms.filter(x =>
      (x.span.start < span.end && x.span.end > span.start) ||
      (x.span.start === x.span.end && x.span.start > span.start && x.span.start < span.end));
    if (!affected.length || affected.some(x => x.kind !== "cell" || x.textMarker || x.span.start < span.start || x.span.end > span.end)) {
      diagnostics.push(ambiguityDiagnostic("ambiguity-fraction-scope-unsupported", a.span));
      continue;
    }
    const encoded = encodeMath(parseMath(source.slice(span.start, span.end), span));
    if (!encoded.complete || encoded.diagnostics.length || encoded.atoms.some(x => x.span.start < span.start || x.span.end > span.end)) {
      diagnostics.push(ambiguityDiagnostic("ambiguity-fraction-scope-unsupported", a.span));
      continue;
    }
    const first = result.atoms.indexOf(affected[0]), last = result.atoms.indexOf(affected.at(-1)!);
    result.atoms.splice(first, last - first + 1, ...encoded.atoms.map(atom => ({ ...atom, group: `numeric-fraction:${a.id}` })));
    result.diagnostics = result.diagnostics.filter(d => !(d.code === "bare-ambiguous-formula" && d.span.start === span.start && d.span.end === span.end));
    result.document.diagnostics = result.document.diagnostics.filter(d => !(d.code === "bare-ambiguous-formula" && d.span.start === span.start && d.span.end === span.end));
    recoveredBareFraction = true;
  }
  for (const a of ambiguities.filter((a) => a.kind === "colon")) {
    const r = decisions.get(a.id);
    if (!r) continue;
    if (r.choice === "mapping") {
      if (a.mappingSyntax) continue;
      diagnostics.push(
        ambiguityDiagnostic("ambiguity-mapping-unsupported", a.span),
      );
      continue;
    }
    const plainScope =
      (!options.mode ||
        options.mode === "document" ||
        options.mode === "text") &&
      result.document.nodes.some(
        (n) =>
          n.kind === "text" &&
          n.span.start <= a.span.start &&
          n.span.end >= a.span.end,
      );
    if (r.choice === "ratio") {
      // A whole numeric ratio is an expression (§6.1.2.1), not an isolated
      // prose symbol (§5.4.2.4). Preserve existing explicit math-node encoding.
      if (!plainScope) continue;
      const span = a.tokenSpan;
      const afterLabel = span && /(?:比例|比值|配比)\s*[:：]$/.test(source.slice(0,span.start));
      if (!span || (/[\d.:：+\-−]/.test(source[span.start - 1] ?? '') && !afterLabel) || /[\d.:：+\-−]/.test(source[span.end] ?? '')) {
        diagnostics.push(ambiguityDiagnostic('ambiguity-ratio-scope-unsupported',a.span));
        continue;
      }
      const affected = result.atoms.filter(x=>x.span.start < span.end && x.span.end > span.start);
      if (!affected.length || affected.some(x=>x.span.start<span.start || x.span.end>span.end || x.kind!=='cell' || x.textMarker)) {
        diagnostics.push(ambiguityDiagnostic('ambiguity-ratio-scope-unsupported',a.span));
        continue;
      }
      const encoded = encodeMath(parseMath(source.slice(span.start,span.end).replaceAll('：',':'),span),{colonMeaning:()=> 'ratio'});
      if (!encoded.complete) {
        diagnostics.push(ambiguityDiagnostic('ambiguity-ratio-scope-unsupported',a.span));
        continue;
      }
      const first=result.atoms.indexOf(affected[0]), last=result.atoms.indexOf(affected.at(-1)!);
      result.atoms.splice(first,last-first+1,...encoded.atoms.map(atom=>({...atom,group:`numeric-ratio:${a.id}`})));
      continue;
    }
    if (r.choice === "punctuation") {
      if (!plainScope) {
        diagnostics.push(
          ambiguityDiagnostic(
            "ambiguity-punctuation-scope-unsupported",
            a.span,
          ),
        );
        continue;
      }
      const cells = encodeText("：").atoms[0].cells;
      result.atoms = result.atoms
        .filter(
          (atom) =>
            !(
              atom.kind === "cell" &&
              atom.span.start === a.span.start &&
              atom.span.end === a.span.end &&
              /^\u2800+$/.test(atom.cells)
            ),
        )
        .map((atom) =>
          atom.kind === "cell" &&
          atom.span.start === a.span.start &&
          atom.span.end === a.span.end &&
          atom.ruleId !== "unhandled-placeholder"
            ? { ...atom, cells, ruleId: "GF0019-2018-8" }
            : atom,
        );
      continue;
    }
    if (!["time","duration","duration-ms"].includes(r.choice)) continue;
    const duration = r.choice !== "time", minutesOnly = r.choice === "duration-ms";
    if (
      options.timePolicy === "preserve" ||
      !validTime(a, source, duration) || (minutesOnly && a.tokenSpan && source.slice(a.tokenSpan.start,a.tokenSpan.end).split(/[:：]/).length !== 2)
    ) {
      diagnostics.push(
        ambiguityDiagnostic("ambiguity-time-unsupported", a.span),
      );
      continue;
    }
    if (!plainScope) {
      diagnostics.push(
        ambiguityDiagnostic("ambiguity-time-scope-unsupported", a.span),
      );
      continue;
    }
    const span = a.tokenSpan!,
      parts = source.slice(span.start, span.end).split(/[:：]/),
      units = minutesOnly ? ["分", "秒"] : ["时", "分", "秒"],
      readings = minutesOnly ? ["fen1", "miao3"] : ["shi2", "fen1", "miao3"],
      normalized = parts.map((part,i) => part + units[i]).join("");
    const affected = result.atoms.filter(
      (x) => x.span.start < span.end && x.span.end > span.start,
    );
    if (
      !affected.length ||
      affected.some(
        (x) =>
          x.span.start < span.start ||
          x.span.end > span.end ||
          x.kind !== "cell" ||
          (x.kind === "cell" && x.textMarker),
      )
    ) {
      diagnostics.push(
        ambiguityDiagnostic("ambiguity-time-scope-unsupported", a.span),
      );
      continue;
    }
    const replacement = encodeText(normalized, 0, {
      chinese: options.chinese,
      overrides: parts.map((part,i) => {
        const start = parts.slice(0,i+1).reduce((sum,p) => sum+p.length,0)+i;
        return {start,end:start+1,readings:[readings[i]]};
      }),
    }).atoms.map((atom) => ({
      ...atom,
      span:
        atom.span.start === normalized.length - 1
          ? { start: span.end, end: span.end }
          : {
              start: span.start + atom.span.start,
              end: Math.min(span.end, span.start + atom.span.end),
            },
      // Keep the expanded clock together; never leave its unit on another line.
      group: `normalized-time:${a.id}`,
    }));
    const first = result.atoms.indexOf(affected[0]),
      last = result.atoms.indexOf(affected.at(-1)!);
    result.atoms.splice(first, last - first + 1, ...replacement);
    diagnostics.push({
      ...ambiguityDiagnostic(duration ? "ambiguity-duration-normalized" : "ambiguity-time-normalized", span, "info"),
      message: `${duration ? "Duration" : "Clock time"} normalized to ${normalized} using existing number and Chinese encoders. This is an explicit ${minutesOnly ? "minutes:seconds" : "hours:minutes[:seconds]"} semantic normalization policy, not a verified clock-colon cell rule; the original source is retained.`,
    });
  }
  result.diagnostics.push(...diagnostics);
  const seenDiagnostics = new Set<string>();
  result.diagnostics = result.diagnostics.filter(d => {
    const key = JSON.stringify([d.code, d.severity, d.span.start, d.span.end, d.message]);
    if (seenDiagnostics.has(key)) return false;
    seenDiagnostics.add(key);
    return true;
  });
  if (recoveredBareFraction && !result.unhandled.length && result.diagnostics.every(d => d.severity === "info"))
    result.complete = true;
  result.complete &&= !diagnostics.some((d) => d.severity !== "info");
  return result;
}
