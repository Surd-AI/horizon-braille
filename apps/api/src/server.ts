import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import {
  resolveAmbiguities,
  convertWithResolutions,
  isFallbackCode,
  type AmbiguityProvider,
  type DecisionSet,
  type SemanticOptions,
} from "../../../packages/core/src/ambiguity";
import { reflowExistingAtoms } from "../../../packages/core/src/convert";
import { normalizeManualReading } from "../../../packages/core/src/language/reading-validation";
import { validWordBoundaries } from "../../../packages/core/src/language/chinese";
import { segmentDocument, type SegmentationBackend } from "./hanlp-provider";
import { DecisionCache } from "./decision-cache";
import { exceedsEditorInputLimit, EDITOR_MAX_CHARACTERS } from '../../shared/input-limits';

export interface ServerOptions {
  port?: number;
  origins?: string[];
  /** Explicit reverse-proxy deployment opt-in; listener remains loopback-only. */
  allowHttpsOrigins?: boolean;
  provider: AmbiguityProvider;
  configured: boolean;
  /** Only supplied by the loopback launcher; never enabled behind the public proxy. */
  userTokenProvider?: (token: string) => AmbiguityProvider;
  segmenter?: SegmentationBackend;
}
export interface LocalServer {
  port: number;
  close: () => Promise<void>;
}
const BODY_LIMIT = 131072;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const keys = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).every((k) => allowed.includes(k));
function decisionSet(value: unknown): value is DecisionSet {
  return (
    record(value) &&
    keys(value, ["documentSource", "resolutions", "fallbackCodes"]) &&
    (value.fallbackCodes === undefined ||
      (Array.isArray(value.fallbackCodes) &&
        value.fallbackCodes.length <= 64 &&
        value.fallbackCodes.every(isFallbackCode))) &&
    typeof value.documentSource === "string" &&
    value.documentSource.length <= 100000 &&
    Array.isArray(value.resolutions) &&
    value.resolutions.length <= 4096 &&
    value.resolutions.every(
      (r) =>
        record(r) &&
        keys(r, ["id", "choice", "source", "probabilities", "confidence"]) &&
        typeof r.id === "string" &&
        r.id.length <= 80 &&
        typeof r.choice === "string" &&
        r.choice.length <= 40 &&
        ["manual", "heuristic", "api"].includes(String(r.source)),
    ) &&
    new Set(value.resolutions.map((r) => r.id)).size ===
      value.resolutions.length
  );
}
function semanticOptions(value: unknown): value is SemanticOptions {
  if (
    !record(value) ||
    !keys(value, [
      "columns",
      "rows",
      "paragraphIndent",
      "strict",
      "mode",
      "recognizeMath",
      "recognizeChemistry",
      "timePolicy",
      "overrides",
      "chinese",
      "wordBoundaries",
    ])
  )
    return false;
  for (const name of ["columns", "rows"])
    if (
      value[name] !== undefined &&
      (!Number.isInteger(value[name]) ||
        Number(value[name]) < 1 ||
        Number(value[name]) > 1000)
    )
      return false;
  if (
    value.paragraphIndent !== undefined &&
    (!Number.isInteger(value.paragraphIndent) ||
      Number(value.paragraphIndent) < 0 ||
      Number(value.paragraphIndent) > 999)
  )
    return false;
  if (value.strict !== undefined && typeof value.strict !== "boolean")
    return false;
  for (const name of ["recognizeMath", "recognizeChemistry"])
    if (value[name] !== undefined && typeof value[name] !== "boolean") return false;
  if (
    value.mode !== undefined &&
    !["document", "text", "math", "chemistry", "physics"].includes(String(value.mode))
  )
    return false;
  if (
    value.timePolicy !== undefined &&
    !["preserve", "normalize-hours-minutes"].includes(String(value.timePolicy))
  )
    return false;
  if (value.chinese !== undefined && (!record(value.chinese) ||
    !keys(value.chinese, ["tones", "contractions", "unknownSemanticTone"]) ||
    (value.chinese.tones !== undefined && !["normative", "full"].includes(String(value.chinese.tones))) ||
    (value.chinese.contractions !== undefined && typeof value.chinese.contractions !== "boolean") ||
    (value.chinese.unknownSemanticTone !== undefined && !["retain", "normative"].includes(String(value.chinese.unknownSemanticTone))))) return false;
  if (value.wordBoundaries !== undefined && (!Array.isArray(value.wordBoundaries) || value.wordBoundaries.length > 10000 ||
    !value.wordBoundaries.every(o => record(o) && keys(o,["start","end"]) && Number.isInteger(o.start) && Number.isInteger(o.end)))) return false;
  if (
    value.overrides !== undefined &&
    (!Array.isArray(value.overrides) ||
      value.overrides.length > 4096 ||
      !value.overrides.every(
        (o) =>
          record(o) &&
          keys(o, ["start", "end", "readings", "retainTones"]) &&
          Number.isInteger(o.start) &&
          Number.isInteger(o.end) &&
          Array.isArray(o.readings) &&
          o.readings.length <= 1000 &&
          o.readings.every((r) => typeof r === "string" && r.length <= 16 && normalizeManualReading(r)) &&
          (o.retainTones === undefined ||
            (Array.isArray(o.retainTones) &&
              o.retainTones.every((t) => typeof t === "boolean"))),
      ))
  )
    return false;
  return true;
}
async function body(req: IncomingMessage): Promise<unknown> {
  let length = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > BODY_LIMIT) throw 413;
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw 400;
  }
}
/** A local-only service. Importing this module never reads environment files or binds a port. */
export async function startLocalServer(
  options: ServerOptions,
): Promise<LocalServer> {
  const port = options.port ?? 8787,
    origins = options.origins ?? ["http://127.0.0.1:5173"];
  if (
    !Number.isInteger(port) ||
    port < 0 ||
    port > 65535 ||
    !origins.length ||
    origins.some((origin) => {
      try {
        const u = new URL(origin);
        const remote = options.allowHttpsOrigins === true && u.protocol === "https:" &&
          !u.username && !u.password && !u.hostname.includes("*") && u.origin === origin;
        if (remote) return false;
        return (
          u.protocol !== "http:" ||
          u.hostname !== "127.0.0.1" ||
          !u.port ||
          u.origin !== origin
        );
      } catch {
        return true;
      }
    })
  )
    throw new Error("Invalid local API configuration");
  let active = 0;
  const decisionCache = new DecisionCache();
  const server = createServer(async (req, res) => {
    let streaming = false;
    const send = (status: number, value: unknown) => {
      if (res.destroyed || res.writableEnded) return;
      if (streaming) {res.end(JSON.stringify(status===200 ? {type:'result',data:value} : {type:'error',status})+'\n');return;}
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(value));
    };
    const actual = (server.address() as AddressInfo).port;
    if (req.headers.host !== `127.0.0.1:${actual}`) {
      send(403, { error: "host-not-allowed" });
      return;
    }
    const origin = req.headers.origin;
    if (origin !== undefined && !origins.includes(origin)) {
      send(403, { error: "origin-not-allowed" });
      return;
    }
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    if (req.url === "/health" && req.method === "GET") {
      send(200, { configured: options.configured, userKeySupported: !!options.userTokenProvider });
      return;
    }
    if (req.url !== "/resolve" && req.url !== "/convert" && req.url !== "/segment") {
      send(404, { error: "not-found" });
      return;
    }
    if (!origin) {
      send(403, { error: "origin-required" });
      return;
    }
    if (req.method === "OPTIONS") {
      if (
        req.headers["access-control-request-method"] !== "POST" ||
        (req.headers["access-control-request-headers"] ?? "")
          .toLowerCase()
          .split(",")
          .map((s) => s.trim())
          .some((s) => s && s !== "content-type" &&
            !(s === "x-surdai-key" && options.userTokenProvider && origin.startsWith("http://127.0.0.1:")))
      ) {
        send(403, { error: "preflight-not-allowed" });
        return;
      }
      res.setHeader("Access-Control-Allow-Methods", "POST");
      res.setHeader("Access-Control-Allow-Headers", options.userTokenProvider ? "Content-Type, X-SurdAI-Key" : "Content-Type");
      send(200, {});
      return;
    }
    if (req.method !== "POST") {
      send(405, { error: "method-not-allowed" });
      return;
    }
    if (
      !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(
        req.headers["content-type"] ?? "",
      )
    ) {
      send(415, { error: "json-required" });
      return;
    }
    if (
      req.headers["content-encoding"] ||
      Number(req.headers["content-length"]) > BODY_LIMIT
    ) {
      send(413, { error: "body-too-large-or-encoded" });
      return;
    }
    if (active >= 2) {
      send(429, { error: "local-busy" });
      return;
    }
    const suppliedToken = req.headers["x-surdai-key"];
    if (suppliedToken !== undefined &&
      (req.url !== "/resolve" || !options.userTokenProvider ||
        !origin.startsWith("http://127.0.0.1:") ||
        typeof suppliedToken !== "string" ||
        !/^sx_[A-Za-z0-9_-]{16,256}$/.test(suppliedToken))) {
      send(400, { error: "invalid-user-key" });
      return;
    }
    const controller = new AbortController(),
      abort = () => controller.abort();
    req.on("aborted", abort);
    res.on("close", abort);
    active++;
    try {
      const data = await body(req);
      if (
        !record(data) ||
        !keys(data, ["source", "options", "manual", "decisions", "external", "stream"]) ||
        typeof data.source !== "string" ||
        data.source.length > 100000 ||
        (data.options !== undefined && !semanticOptions(data.options)) ||
        (data.manual !== undefined && !decisionSet(data.manual)) ||
        (data.decisions !== undefined && !decisionSet(data.decisions)) ||
        (data.external !== undefined && typeof data.external !== "boolean") ||
        (data.stream !== undefined && (typeof data.stream !== "boolean" || req.url !== "/resolve"))
      ) {
        send(400, { error: "invalid-request" });
        return;
      }
      if (exceedsEditorInputLimit(data.source)) {
        send(413,{error:'source-too-long',maxCharacters:EDITOR_MAX_CHARACTERS}); return;
      }
      const encodingOptions: SemanticOptions = (data.options ??
        {}) as SemanticOptions;
      if (encodingOptions.wordBoundaries !== undefined && !validWordBoundaries(data.source, encodingOptions.wordBoundaries)) {
        send(400, {error:"invalid-word-boundaries"}); return;
      }
      if (req.url === "/segment") {
        if (!keys(data,["source","options"])) { send(400,{error:"invalid-request"}); return; }
        if (!options.segmenter) { send(503,{error:"segmentation-unconfigured"}); return; }
        try {
          const segmented = await segmentDocument(data.source,encodingOptions,options.segmenter,controller.signal);
          if (!controller.signal.aborted) send(200,segmented);
        } catch { if (!controller.signal.aborted) send(503,{error:"segmentation-unavailable"}); }
        return;
      }
      if (req.url === "/convert" && !data.decisions) {
        send(400, { error: "decisions-required" });
        return;
      }
      if (req.url === "/resolve" && data.decisions) {
        send(400, { error: "use-convert-for-existing-decisions" });
        return;
      }
      const decisions =
        req.url === "/resolve"
          ? await resolveAmbiguities(data.source, {
              ...encodingOptions,
              manual: data.manual as DecisionSet | undefined,
              modelFirst: true, processAll: true,
              batchSize: data.stream===true ? 16 : 64, timeBudgetMs: data.stream===true ? 120000 : 45000,
              onProgress: data.stream === true ? progress => {
                if(controller.signal.aborted || res.destroyed || res.writableEnded)return;
                if(!streaming){res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Accel-Buffering':'no','X-Content-Type-Options':'nosniff'});streaming=true;res.flushHeaders();}
                res.write(JSON.stringify({type:'progress',...progress})+'\n');
              } : undefined,
              provider: data.external === false ? undefined : suppliedToken
                ? options.userTokenProvider!(suppliedToken)
                : decisionCache.providerForRequest(options.provider),
              signal: controller.signal,
            })
          : (data.decisions as DecisionSet);
      if (controller.signal.aborted) return;
      const encoded = convertWithResolutions(
          data.source,
          decisions,
          encodingOptions,
        ),
        conversion = reflowExistingAtoms(encoded, encodingOptions);
      send(200, {
        audit: "audit" in decisions ? decisions.audit : undefined,
        decisions: {
          documentSource: decisions.documentSource,
          resolutions: decisions.resolutions,
          ...(decisions.fallbackCodes?.length
            ? { fallbackCodes: [...new Set(decisions.fallbackCodes)] }
            : {}),
        },
        ambiguities:
          "ambiguities" in decisions ? decisions.ambiguities : undefined,
        encoded,
        conversion,
        status: {
          semanticComplete: encoded.complete,
          layoutComplete: !conversion.diagnostics
            .slice(encoded.diagnostics.length)
            .some((d) => d.severity !== "info"),
          providerFallback: encoded.diagnostics.some((d) =>
            isFallbackCode(d.code),
          ),
        },
      });
    } catch (error) {
      send(error === 413 ? 413 : error === 400 ? 400 : 500, {
        error:
          error === 413
            ? "body-too-large"
            : error === 400
              ? "invalid-json"
              : "internal-error",
      });
    } finally {
      active--;
      req.off("aborted", abort);
      res.off("close", abort);
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.timeout = 20000;
  server.maxHeadersCount = 32;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  return {
    port: (server.address() as AddressInfo).port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeIdleConnections();
      }),
  };
}
