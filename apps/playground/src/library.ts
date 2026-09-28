export { mountEditor, examples } from "./editor";
export type { EditorOptions } from "./editor";
// Existing product controls can share the Worker/session without mounting the demo UI.
export { createSession } from "./client";
export type { SessionClientOptions } from "./client";
export type { EditorSession, SemanticJob, SemanticReply, SegmenterProvider, SegmentationReply } from "./session";
export * from "../../../packages/core/src/index";

// Shared standards evidence for the original product audit download.
import registryData from "../../../standards/registry.json";
import coverageData from "../../../standards/coverage.json";
// Inferred constants emit self-contained declarations without missing JSON imports.
export const registry = registryData;
export const coverage = coverageData;

export {readDecisionResponse} from "./decision-stream";
