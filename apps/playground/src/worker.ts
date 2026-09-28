import { executeSemanticJob, type SemanticJob } from "./session";
self.onmessage = async ({ data }: { data: { id: number; job: SemanticJob } }) => {
  try {
    self.postMessage({ id: data.id, reply: await executeSemanticJob(data.job) });
  } catch (e) {
    self.postMessage({ id: data.id, error: e instanceof Error ? e.message : "本地转换失败" });
  }
};
