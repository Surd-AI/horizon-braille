import { collectAmbiguities, validateResolution, resolveAmbiguities, convertWithResolutions } from "../../../packages/core/src/ambiguity";
import {
  reflowExistingAtoms,
  type EncodedDocument,
  type UnifiedConversionResult,
} from "../../../packages/core/src/convert";
import type {
  Ambiguity,
  DecisionAudit,
  DecisionProgress,
  DecisionSet,
  SemanticOptions,
} from "../../../packages/core/src/ambiguity";
import type { PublishingOptions } from "../../../packages/core/src/layout";
import type { SourceSpan } from "../../../packages/core/src/model";
import { validWordBoundaries, wordBoundariesCoverWords } from "../../../packages/core/src/language/chinese";
import { exceedsEditorInputLimit, EDITOR_INPUT_LIMIT_MESSAGE } from '../../shared/input-limits';
export interface SegmentationReply {
  documentSource: string;
  wordBoundaries: SourceSpan[];
  model: string;
}
export type SegmenterProvider = (job: SemanticJob, signal: AbortSignal) => Promise<SegmentationReply>;
export interface SemanticJob {
  source: string;
  options: SemanticOptions;
  decisions?: DecisionSet;
}
export interface SemanticReply {
  encoded: EncodedDocument;
  decisions: DecisionSet;
  ambiguities: Ambiguity[];
}
/** Runs in the semantic Worker; filtering here keeps full-source work off the UI thread. */
export async function executeSemanticJob(job: SemanticJob): Promise<SemanticReply> {
  const { source, options } = job;
  if (exceedsEditorInputLimit(source)) throw new Error(EDITOR_INPUT_LIMIT_MESSAGE);
  let decisions = job.decisions;
  if (!decisions) {
    const local = await resolveAmbiguities(source, options);
    decisions = { documentSource: source, resolutions: local.resolutions };
  } else {
    const candidates = collectAmbiguities(source, options);
    decisions = {
      ...decisions,
      resolutions: decisions.documentSource === source
        ? decisions.resolutions.filter(r => candidates.some(a => validateResolution(a, r)))
        : [],
    };
  }
  // Shared encoder applies provenance, probability and grammar guards again.
  const encoded = convertWithResolutions(source, decisions, options);
  return { encoded, decisions, ambiguities: collectAmbiguities(encoded) };
}
export type Execute = (job: SemanticJob) => Promise<SemanticReply>;
export type Provider = (
  job: SemanticJob,
  signal: AbortSignal,
  onProgress?: (progress: DecisionProgress) => Promise<void>,
) => Promise<DecisionSet | { decisions: DecisionSet; audit?: DecisionAudit }>;
export interface DecisionHistory {
  id: number; requestedAt: string; source: string; options: SemanticOptions;
  status: "pending" | "complete" | "failed" | "canceled"; durationMs?: number;
  audit?: DecisionAudit; outcome?: string;
}
/** Semantic edits cancel work. Layout edits retain semantic identity and pending provider work. */
export class EditorSession {
  source = "";
  options: SemanticOptions = { mode: "document" };
  layout: PublishingOptions = {
    columns: 30,
    rows: 25,
    paragraphIndent: 2,
    strict: true,
  };
  result?: UnifiedConversionResult;
  encoded?: EncodedDocument;
  decisions?: DecisionSet;
  ambiguities: Ambiguity[] = [];
  semanticRevision = 0;
  layoutRevision = 0;
  busy = false;
  onlineBusy = false;
  decisionProgress: DecisionProgress | null = null;
  reviewedDecisionIds: string[] = [];
  segmentBusy = false;
  segmentStatus: "idle" | "loading" | "success" | "error" = "idle";
  segmentModel = "";
  segmentError = "";
  error = "";
  onChange = () => {};
  history: DecisionHistory[] = [];
  private historySerial = 0;
  private abort?: AbortController;
  clearHistory() { this.history = []; this.notify(); }
  exportHistory() { return JSON.stringify({ version: 1, history: this.history }, null, 2); }
  private notify() { try { this.onChange(); } catch { /* Observers cannot affect conversion. */ } }
  constructor(
    private execute: Execute,
    private provider?: Provider,
    private cancelWorker = () => {},
    private segmenter?: SegmenterProvider,
  ) {}
  async setSource(source: string) {
    this.source = source;
    this.options = { ...this.options, overrides: [], wordBoundaries: undefined };
    this.segmentStatus = "idle";
    this.segmentModel = "";
    this.segmentError = "";
    this.decisions = undefined;
    return this.recompute();
  }
  async setOptions(options: Partial<SemanticOptions>) {
    const parsingChanged = (["mode", "recognizeMath", "recognizeChemistry"] as const)
      .some(k => k in options && options[k] !== this.options[k]);
    this.options = { ...this.options, ...options };
    if (parsingChanged) {
      this.options.wordBoundaries = undefined;
      this.segmentStatus = "idle";
      this.segmentModel = "";
      this.segmentError = "";
    }
    // Keep source-bound decisions for the Worker to revalidate against new options.
    return this.recompute();
  }
  async choose(id: string, choice: string) {
    this.decisions = {
      documentSource: this.source,
      resolutions: [
        ...(this.decisions?.resolutions ?? []).filter((r) => r.id !== id),
        { id, choice, source: "manual" },
      ],
    };
    return this.recompute();
  }
  async recompute() {
    const revision = ++this.semanticRevision;
    this.abort?.abort();
    this.cancelWorker();
    this.onlineBusy = false;
    this.segmentBusy = false;
    if (this.segmentStatus === "loading") this.segmentStatus = "idle";
    this.busy = true;
    this.error = "";
    this.result = undefined;
    this.encoded = undefined;
    this.ambiguities = [];
    if (exceedsEditorInputLimit(this.source)) {
      this.busy = false;
      this.error = EDITOR_INPUT_LIMIT_MESSAGE;
      this.notify();
      return;
    }
    this.notify();
    try {
      const response = await this.execute({
        source: this.source,
        options: this.options,
        decisions: this.decisions,
      });
      if (revision !== this.semanticRevision) return;
      this.accept(response);
    } catch (e) {
      if (revision === this.semanticRevision)
        this.error = e instanceof Error ? e.message : "转换失败";
    } finally {
      if (revision === this.semanticRevision) {
        this.busy = false;
        this.notify();
      }
    }
  }
  private accept(response: SemanticReply) {
    if (response.encoded.document.source !== this.source)
      throw new Error("结果原文不匹配，已拒绝");
    this.encoded = response.encoded;
    this.decisions = response.decisions;
    this.ambiguities = response.ambiguities;
    this.result = reflowExistingAtoms(this.encoded, this.layout);
  }
  setLayout(options: PublishingOptions) {
    this.layout = { ...this.layout, ...options };
    this.layoutRevision++;
    if (this.encoded)
      this.result = reflowExistingAtoms(this.encoded, this.layout);
    this.notify();
  }
  async resolveOnline() {
    if (exceedsEditorInputLimit(this.source)) return;
    if (this.busy || this.onlineBusy || this.segmentBusy) return;
    const revision = this.semanticRevision,
      abort = new AbortController();
    this.abort = abort;
    this.onlineBusy = true;
    this.decisionProgress = null;
    this.reviewedDecisionIds = [];
    const started = performance.now();
    const entry: DecisionHistory = {
      id: ++this.historySerial, requestedAt: new Date().toISOString(), source: this.source,
      options: JSON.parse(JSON.stringify(this.options)), status: "pending",
    };
    this.history = [entry, ...this.history].slice(0, 20);
    const end = (status: DecisionHistory["status"]) => {
      if (entry.status !== "pending") return;
      entry.status = status; entry.durationMs = Math.max(0, performance.now() - started);
      this.notify();
    };
    abort.signal.addEventListener("abort", () => end("canceled"), { once: true });
    this.error = "";
    this.notify();
    try {
      const reply = this.provider ? await this.provider(
        {
          source: this.source,
          options: this.options,
          decisions: this.decisions,
        },
        abort.signal,
        async progress => {
          if(abort.signal.aborted || revision!==this.semanticRevision)return;
          this.decisionProgress={completed:progress.completed,total:progress.total,localResolved:progress.localResolved};
          this.reviewedDecisionIds=[...new Set([...this.reviewedDecisionIds,...(progress.reviewedIds||[])])];
          if(progress.resolutions?.length){
            const merged=new Map((this.decisions?.resolutions||[]).map(r=>[r.id,r]));
            for(const r of progress.resolutions)if(r?.source==='api' && this.ambiguities.some(a=>validateResolution(a,r)) && merged.get(r.id)?.source!=='manual')merged.set(r.id,r);
            const response=await this.execute({source:this.source,options:this.options,decisions:{documentSource:this.source,resolutions:[...merged.values()]}});
            if(abort.signal.aborted || revision!==this.semanticRevision)return;
            this.accept(response);
          }
          this.notify();
        },
      ) : await (async () => {
        const local = await resolveAmbiguities(this.source, { ...this.options, manual: this.decisions });
        return { decisions: { documentSource: local.documentSource, resolutions: local.resolutions, fallbackCodes: local.fallbackCodes }, audit: local.audit };
      })();
      if (abort.signal.aborted || revision !== this.semanticRevision) return;
      const decisions = "decisions" in reply ? reply.decisions : reply;
      try { entry.audit = "decisions" in reply && reply.audit ? structuredClone(reply.audit) : undefined; } catch { entry.outcome = "audit-unavailable"; }
      const response = await this.execute({
        source: this.source,
        options: this.options,
        decisions,
      });
      if (abort.signal.aborted || revision !== this.semanticRevision) return;
      this.accept(response);
      end("complete");
    } catch (e) {
      entry.outcome = "local-service-error";
      end(abort.signal.aborted ? "canceled" : "failed");
      if (!abort.signal.aborted && revision === this.semanticRevision)
        this.error =
          "在线消歧未完成；已完成的判断和盲文结果已保留。" +
          (e instanceof Error ? e.message : "服务不可用");
    } finally {
      if (revision === this.semanticRevision && this.abort === abort) {
        this.onlineBusy = false;
        this.notify();
      }
    }
  }
  async segmentOnline(): Promise<boolean> {
    if (this.busy || this.onlineBusy || this.segmentBusy || !this.encoded) return false;
    const revision = this.semanticRevision, source = this.source, abort = new AbortController();
    this.abort = abort;
    this.segmentBusy = true;
    this.segmentStatus = "loading";
    this.segmentError = "";
    this.notify();
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let interrupted = () => {};
    const deadline = new Promise<never>((_, reject) => {
      interrupted = () => reject(new Error("segmentation-cancelled"));
      abort.signal.addEventListener("abort", interrupted, {once:true});
      timer = setTimeout(() => {
        timedOut = true;
        abort.abort();
        reject(new Error("segmentation-deadline"));
      }, 15000);
    });
    try {
      if (!this.segmenter) throw new Error("分词服务未配置");
      const reply = await Promise.race([deadline,
        this.segmenter({source, options: this.options, decisions: this.decisions}, abort.signal)]);
      if (abort.signal.aborted || revision !== this.semanticRevision) return false;
      if (!reply || reply.documentSource !== source || typeof reply.model !== "string" ||
        !reply.model || reply.model.length > 160 || !validWordBoundaries(source, reply.wordBoundaries) ||
        !wordBoundariesCoverWords(reply.wordBoundaries, this.encoded!.metadata.chineseWords))
        throw new Error("分词结果与原文不匹配");
      const options = {...this.options, wordBoundaries: reply.wordBoundaries.map(s => ({...s}))};
      const response = await Promise.race([deadline, this.execute({source, options, decisions: this.decisions})]);
      if (abort.signal.aborted || revision !== this.semanticRevision) return false;
      if (response.encoded.diagnostics.some(d => d.code === "CHINESE_INVALID_WORD_BOUNDARIES"))
        throw new Error("分词边界无效");
      this.accept(response);
      this.options = options;
      this.segmentModel = reply.model;
      this.segmentStatus = "success";
      return true;
    } catch {
      if ((!abort.signal.aborted || timedOut) && revision === this.semanticRevision && this.abort === abort) {
        this.segmentStatus = "error";
        this.segmentError = "在线分词未完成；保留现有结果和人工修改。";
      }
      return false;
    } finally {
      clearTimeout(timer);
      abort.signal.removeEventListener("abort", interrupted);
      if (revision === this.semanticRevision && this.abort === abort) {
        if (timedOut) this.cancelWorker();
        this.segmentBusy = false;
        if (abort.signal.aborted && !timedOut) this.segmentStatus = "idle";
        this.notify();
      }
    }
  }
  cancelOnline() {
    this.abort?.abort();
    this.onlineBusy = false;
    this.segmentBusy = false;
    if (this.segmentStatus === "loading") this.segmentStatus = "idle";
    this.notify();
  }
  dispose() {
    this.semanticRevision++;
    this.abort?.abort();
    this.cancelWorker();
    this.onChange = () => {};
  }
}
