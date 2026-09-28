import {
  validateResolution,
  type Ambiguity,
  type AmbiguityProvider,
  type Resolution,
} from "../../../packages/core/src/ambiguity";

// Only successful model answers are cached. Context, target position and
// candidates are part of the key, so an edit in the same sentence invalidates
// the answer while an unrelated edit elsewhere can reuse it.
const MAX_ENTRIES = 512;
const TTL_MS = 20 * 60 * 1000;

function key(question: Ambiguity): string {
  return JSON.stringify([
    question.kind, question.context, question.contextTarget,
    question.contextWord, question.candidates,
    question.plainText, question.mappingSyntax,
  ]);
}

function copy(answer: Resolution, id: string): Resolution {
  return {
    id, choice: answer.choice, source: "api",
    ...(answer.confidence === undefined ? {} : {confidence: answer.confidence}),
    ...(answer.probabilities ? {probabilities: {...answer.probabilities}} : {}),
  };
}

/** One bounded, in-memory cache per API listener; no disk or browser storage. */
export class DecisionCache {
  private entries = new Map<string, {answer: Resolution; expires: number}>();
  constructor(private now = () => Date.now()) {}
  // Snapshot readable entries at request start. Batches in one request cannot
  // silently skip later model work and distort streamed progress counts.
  providerForRequest(provider: AmbiguityProvider): AmbiguityProvider {
    const available = new Map(this.entries);
    return async (questions, signal) => {
    const hits: Resolution[] = [];
    const missing: Ambiguity[] = [];
    for (const question of questions) {
      const cacheKey = key(question);
      const entry = available.get(cacheKey);
      if (entry && entry.expires > this.now()) {
        this.entries.delete(cacheKey);
        this.entries.set(cacheKey, entry);
        hits.push(copy(entry.answer, question.id));
      } else {
        if (entry) this.entries.delete(cacheKey);
        missing.push(question);
      }
    }
    if (!missing.length) return {
      resolutions: hits, diagnostics: [],
      trace: {requestSent: false, outcome: "cache-hit", service: "Simplex systemone", model: "spx-cd-auto", reasoning: false},
    };
    const response = await provider(missing, signal);
    if (!signal?.aborted && !response.diagnostics.length && response.trace?.outcome === "complete") {
      for (const question of missing) {
        const matches = response.resolutions.filter(answer => answer.id === question.id);
        if (matches.length !== 1) continue;
        const answer = matches[0];
        if (!validateResolution(question, answer) || answer.source !== "api" || answer.choice === "unknown" ||
          (answer.confidence ?? answer.probabilities?.[answer.choice] ?? 0) < 0.5) continue;
        const cacheKey = key(question);
        this.entries.delete(cacheKey);
        this.entries.set(cacheKey, {answer: copy(answer, ""), expires: this.now() + TTL_MS});
        if (this.entries.size > MAX_ENTRIES) this.entries.delete(this.entries.keys().next().value!);
      }
    }
    return {...response, resolutions: [...hits, ...response.resolutions]};
    };
  }
}
