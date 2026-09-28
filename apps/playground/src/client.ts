import { readDecisionResponse } from "./decision-stream";
import InlineWorker from "./worker?worker&inline";
import { EditorSession, type SemanticJob, type SemanticReply, type SegmenterProvider, type Provider } from "./session";
import type { DecisionSet } from "../../../packages/core/src/ambiguity";
export const API = "http://127.0.0.1:8787";
export interface SessionClientOptions { segmenter?: SegmenterProvider; resolver?: Provider; userToken?: () => string }
export function createSession(options: SessionClientOptions = {}) {
  let worker: Worker | undefined;
  let serial = 0;
  const pending = new Map<
    number,
    { resolve: (r: SemanticReply) => void; reject: (e: Error) => void }
  >();
  const cancel = () => {
    worker?.terminate();
    worker = undefined;
    for (const p of pending.values()) p.reject(new Error("已取消旧任务"));
    pending.clear();
  };
  const execute = (job: SemanticJob) =>
    new Promise<SemanticReply>((resolve, reject) => {
      if (!worker) {
        worker = new InlineWorker();
        worker.onmessage = ({ data }) => {
          const p = pending.get(data.id);
          if (p) {
            pending.delete(data.id);
            data.error
              ? p.reject(new Error(data.error))
              : p.resolve(data.reply);
          }
        };
        worker.onerror = () => {
          for (const p of pending.values())
            p.reject(new Error("Worker 加载失败"));
          pending.clear();
        };
      }
      const id = ++serial;
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, job });
    });
  return new EditorSession(
    execute,
    options.resolver ?? (async (job, signal, onProgress) => {
      const { mode, overrides, timePolicy, recognizeMath, recognizeChemistry, chinese, wordBoundaries } = job.options;
      const response = await fetch(API + "/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(options.userToken?.() ? { "X-SurdAI-Key": options.userToken() } : {}) },
        signal,
        body: JSON.stringify({
          source: job.source,
          options: { mode, overrides, timePolicy, recognizeMath, recognizeChemistry, chinese, wordBoundaries },
          manual: job.decisions
            ? {
                documentSource: job.source,
                resolutions: job.decisions.resolutions.filter(
                  (r) => r.source === "manual",
                ),
              }
            : undefined,
          external: true, stream: true,
        }),
      });
      if (!response.ok) throw new Error("本地服务 HTTP " + response.status);
      const data = await readDecisionResponse(response,signal,onProgress);
      if (
        data.decisions?.documentSource !== job.source ||
        !Array.isArray(data.decisions.resolutions)
      )
        throw new Error("本地服务返回无效结果");
      return { decisions: data.decisions as DecisionSet, audit: data.audit };
    }),
    cancel,
    options.segmenter ?? (async (job, signal) => {
      const { mode, overrides, timePolicy, recognizeMath, recognizeChemistry, chinese, wordBoundaries } = job.options;
      const response = await fetch(API + "/segment", {
        method: "POST", headers: {"Content-Type":"application/json"}, signal,
        body: JSON.stringify({source:job.source, options:{mode, overrides, timePolicy, recognizeMath, recognizeChemistry, chinese, wordBoundaries}}),
      });
      if (!response.ok) throw new Error("本地分词服务 HTTP " + response.status);
      // EditorSession validates source identity, full Han coverage and Unicode offsets.
      return response.json();
    }),
  );
}
