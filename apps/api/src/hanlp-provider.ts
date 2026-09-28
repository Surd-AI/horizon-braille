import { encodeDocument, type ConvertOptions } from "../../../packages/core/src/convert";
import { validWordBoundaries, wordBoundariesCoverWords } from "../../../packages/core/src/language/chinese";
import type { SourceSpan } from "../../../packages/core/src/model";

export interface TokenizationReply { model: string; tokens: string[][] }
export type SegmentationBackend = (texts: string[], signal?: AbortSignal) => Promise<TokenizationReply>;
export interface HanlpOptions { url?: string; fetch?: typeof fetch; timeoutMs?: number }
const MAX_BYTES = 131072;
const MAX_TEXTS = 64, MAX_BLOCK = 4096, MAX_TOTAL = 10000;
const wellFormed = (text: string) => !/[\uD800-\uDFFF]/u.test(text);
function validateTexts(texts: string[]) {
  if (!Array.isArray(texts) || texts.length > MAX_TEXTS ||
    texts.some(t => typeof t !== "string" || !t.length || t.length > MAX_BLOCK || !wellFormed(t)) ||
    texts.reduce((sum,t) => sum + t.length, 0) > MAX_TOTAL)
    throw new Error("segmentation-input-limit");
}
function validateReply(texts: string[], value: unknown): TokenizationReply {
  const r = value as TokenizationReply;
  if (!r || typeof r !== "object" || typeof r.model !== "string" ||
    !r.model || r.model.length > 160 || /[\u0000-\u001f\u007f]/u.test(r.model) ||
    !Array.isArray(r.tokens) || r.tokens.length !== texts.length ||
    r.tokens.some((tokens,i) => !Array.isArray(tokens) || tokens.length > texts[i].length ||
      tokens.some(t => typeof t !== "string" || !t.length || !wellFormed(t)) || tokens.join("") !== texts[i]))
    throw new Error("segmentation-invalid-reply");
  return r;
}
/** No environment access, model import or network until explicitly invoked. */
export function createHanlpSegmenter(options: HanlpOptions = {}): SegmentationBackend {
  return async (texts, signal) => {
    validateTexts(texts);
    if (signal?.aborted) throw new Error("segmentation-cancelled");
    let url: URL;
    try { url = new URL(options.url ?? ""); } catch { throw new Error("segmentation-unconfigured"); }
    if (url.protocol !== "http:" || !["127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.username || url.password || url.pathname !== "/segment" || url.search || url.hash)
      throw new Error("segmentation-invalid-config");
    const timeout = options.timeoutMs ?? 10000;
    if (!Number.isFinite(timeout) || timeout < 1 || timeout > 30000) throw new Error("segmentation-invalid-config");
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancel = () => {};
    const interrupted = new Promise<never>((_, reject) => {
      cancel = () => { controller.abort(); reject(new Error("segmentation-cancelled")); };
      signal?.addEventListener("abort", cancel, {once:true});
      timer = setTimeout(() => { controller.abort(); reject(new Error("segmentation-timeout")); }, timeout);
    });
    try {
      return await Promise.race([interrupted, (async () => {
        const response = await (options.fetch ?? fetch)(url.href, {
          method: "POST", redirect: "error", headers: {"Content-Type":"application/json"},
          body: JSON.stringify({texts}), signal: controller.signal,
        });
        if (controller.signal.aborted) throw new Error("segmentation-cancelled");
        if (!response.ok || !response.body || Number(response.headers.get("content-length")) > MAX_BYTES)
          throw new Error("segmentation-http-failure");
        const reader = response.body.getReader();
        const stop = () => { void reader.cancel().catch(() => {}); };
        controller.signal.addEventListener("abort", stop, {once:true});
        const chunks: Uint8Array[] = []; let size = 0;
        try {
          while (true) {
            const {value, done} = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > MAX_BYTES) throw new Error("segmentation-response-limit");
            chunks.push(value);
          }
        } finally { controller.signal.removeEventListener("abort", stop); stop(); }
        const bytes = new Uint8Array(size); let at = 0;
        for (const chunk of chunks) { bytes.set(chunk,at); at += chunk.byteLength; }
        return validateReply(texts, JSON.parse(new TextDecoder("utf-8", {fatal:true}).decode(bytes)));
      })()]);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      controller.abort();
    }
  };
}

/** Only parsed, source-aligned Han runs reach the backend; formulas remain untouched. */
export async function segmentDocument(source: string, options: ConvertOptions, provider: SegmentationBackend, signal?: AbortSignal) {
  const encoded = encodeDocument(source, {...options, wordBoundaries: undefined});
  const runs: SourceSpan[] = [];
  for (const word of encoded.metadata.chineseWords.filter(w => w.kind === "chinese").sort((a,b) => a.span.start - b.span.start)) {
    if (source.slice(word.span.start, word.span.end) !== word.raw || !/^\p{Script=Han}+$/u.test(word.raw))
      throw new Error("segmentation-source-alignment");
    const last = runs.at(-1);
    if (last && last.end === word.span.start) last.end = word.span.end;
    else runs.push({...word.span});
  }
  const texts = runs.map(r => source.slice(r.start, r.end));
  validateTexts(texts);
  if (signal?.aborted) throw new Error("segmentation-cancelled");
  const reply = texts.length ? validateReply(texts, await provider(texts, signal)) : {model:"not-required",tokens:[]};
  if (signal?.aborted) throw new Error("segmentation-cancelled");
  const wordBoundaries: SourceSpan[] = [];
  reply.tokens.forEach((tokens,i) => {
    let at = runs[i].start;
    for (const token of tokens) {
      for (const han of token.matchAll(/\p{Script=Han}+/gu))
        wordBoundaries.push({start:at + han.index, end:at + han.index + han[0].length});
      at += token.length;
    }
  });
  if (!validWordBoundaries(source, wordBoundaries) || !wordBoundariesCoverWords(wordBoundaries, encoded.metadata.chineseWords))
    throw new Error("segmentation-invalid-boundaries");
  return {documentSource:source, wordBoundaries, model:reply.model};
}
