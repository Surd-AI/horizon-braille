import { it, expect, vi, describe, beforeAll } from "vitest";
import { createSimplexProvider } from "../apps/api/src/simplex-provider";
const a: import("../packages/core/src/ambiguity").Ambiguity = {
  id: "q1",
  kind: "colon",
  span: { start: 2, end: 3 },
  context: "12:30",
  contextTarget: { start: 2, end: 3, text: ":" },
  candidates: [
    { id: "time", description: "clock" },
    { id: "ratio", description: "ratio" },
    { id: "unknown", description: "unknown" },
  ],
};
it.each([401, 429, 503])(
  "status %s is visible fallback with no retry",
  async (status) => {
    const fetcher = vi.fn(async () => new Response("private body", { status }));
    const r = await createSimplexProvider({
      token: "private-token",
      fetch: fetcher,
    })([a]);
    expect(r.resolutions).toEqual([]);
    expect(r.diagnostics[0].code).toBe(`provider-http-${status}`);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(r)).not.toMatch(/private/);
  },
);
it("uses authorized systemone shape and validates candidate IDs", async () => {
  const fetcher = vi.fn(
    async (input: any, init?: any) =>
      new Response(
        JSON.stringify({
          answers: {
            q1: {
              choice: "time",
              probabilities: { time: 0.95, ratio: 0.04, unknown: 0.01 },
              confidence: 0.9,
            },
          },
        }),
      ),
  );
  const r = await createSimplexProvider({ token: "test", fetch: fetcher })([a]);
  expect(fetcher.mock.calls[0][0]).toBe(
    "https://api.surdai.com/v1/systemone",
  );
  const payload = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(Object.keys(payload.questions.q1.criteria)).toEqual([
    "time", "ratio", "unknown",
  ]);
  expect(payload.questions.q1.criteria.time).toContain("时刻");
  expect(r.resolutions[0]).toMatchObject({
    id: "q1",
    choice: "time",
    source: "api",
  });
});
it.each([
  "{",
  '{"answers":{}}',
  '{"answers":{"q1":{"choice":"injected"}}}',
  '{"answers":{"q1":{"choice":"time","probabilities":{"time":2}}}}',
])("rejects bad responses %s", async (body) => {
  const r = await createSimplexProvider({
    token: "test",
    fetch: async () => new Response(body),
  })([a]);
  expect(r.resolutions).toEqual([]);
  expect(r.diagnostics.length).toBeGreaterThan(0);
});
it("no key, timeout and cancellation are distinct visible fallbacks", async () => {
  const fetcher = vi.fn(() => new Promise<Response>(() => {}));
  expect(
    (await createSimplexProvider({ fetch: fetcher })([a])).diagnostics[0].code,
  ).toBe("provider-unconfigured");
  expect(fetcher).not.toHaveBeenCalled();
  expect(
    (
      await createSimplexProvider({
        token: "test",
        fetch: fetcher,
        timeoutMs: 10,
      })([a])
    ).diagnostics[0].code,
  ).toBe("provider-timeout");
  const abort = new AbortController();
  abort.abort();
  expect(
    (
      await createSimplexProvider({ token: "test", fetch: fetcher })(
        [a],
        abort.signal,
      )
    ).diagnostics[0].code,
  ).toBe("provider-cancelled");
});
import { startLocalServer } from "../apps/api/src/server";
import { request } from "node:http";
const localRequest = (
  port: number,
  path: string,
  headers: Record<string, string> = {},
  body?: string,
  method = body === undefined ? "GET" : "POST",
) =>
  new Promise<{ status: number; body: any; headers: any }>(
    (resolve, reject) => {
      const r = request(
        { hostname: "127.0.0.1", port, path, method, headers },
        (res) => {
          let text = "";
          res.on("data", (c) => (text += c));
          res.on("end", () =>
            resolve({
              status: res.statusCode!,
              body: JSON.parse(text),
              headers: res.headers,
            }),
          );
        },
      );
      r.on("error", reject);
      r.end(body);
    },
  );
it("accepts literal text mode without consuming math-delimited line and paragraph breaks", async () => {
  const server = await startLocalServer({
    port: 0,
    configured: false,
    provider: createSimplexProvider(),
  });
  try {
    const source = String.raw`前\(x=1` + "\n" + String.raw`y=2\)後` + "\n\n尾";
    const response = await localRequest(
      server.port,
      "/resolve",
      { Origin: "http://127.0.0.1:5173", "Content-Type": "application/json" },
      JSON.stringify({ source, options: { mode: "text" }, external: false }),
    );
    expect(response.status).toBe(200);
    expect(response.body.encoded.document.source).toBe(source);
    expect(
      response.body.encoded.document.nodes.map((n: any) => n.kind),
    ).toEqual(["text", "line-break", "text", "paragraph-break", "text"]);
  } finally {
    await server.close();
  }
});
it("binds loopback and enforces Host, Origin, JSON, limits and route allowlist", async () => {
  const server = await startLocalServer({
    port: 0,
    provider: createSimplexProvider(),
    configured: false,
  });
  try {
    expect(server.port).toBeGreaterThan(0);
    const good = {
      Origin: "http://127.0.0.1:5173",
      "Content-Type": "application/json",
    };
    expect((await localRequest(server.port, "/health")).body).toEqual({
      configured: false,
      userKeySupported: false,
    });
    expect(
      (await localRequest(server.port, "/health", { Host: "evil.example" }))
        .status,
    ).toBe(403);
    expect(
      (
        await localRequest(
          server.port,
          "/resolve",
          { ...good, Origin: "https://evil.example" },
          "{}",
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await localRequest(
          server.port,
          "/resolve",
          { "Content-Type": "application/json" },
          "{}",
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await localRequest(
          server.port,
          "/resolve",
          { Origin: good.Origin },
          "{}",
        )
      ).status,
    ).toBe(415);
    expect(
      (await localRequest(server.port, "/resolve", good, "{")).status,
    ).toBe(400);
    expect(
      (
        await localRequest(
          server.port,
          "/resolve",
          good,
          JSON.stringify({ source: "12:30", url: "https://evil.example" }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await localRequest(
          server.port,
          "/resolve",
          good,
          JSON.stringify({ source: "a".repeat(140000) }),
        )
      ).status,
    ).toBe(413);
    const response = await localRequest(
      server.port,
      "/resolve",
      good,
      JSON.stringify({ source: "12:30" }),
    );
    expect(response.status).toBe(200);
    expect(response.body.status.providerFallback).toBe(true);
    expect(response.body.status.semanticComplete).toBe(false);
    expect((await localRequest(server.port, "/unknown")).status).toBe(404);
  } finally {
    await server.close();
  }
});
it("uses a page-supplied key only for the current loopback resolve request", async () => {
  const seen: string[] = [];
  const server = await startLocalServer({
    port: 0, configured: false,
    provider: createSimplexProvider(),
    userTokenProvider: token => async () => {
      seen.push(token);
      return {resolutions: [], diagnostics: []};
    },
  });
  try {
    const origin = "http://127.0.0.1:5173";
    expect((await localRequest(server.port, "/health")).body.userKeySupported).toBe(true);
    const valid = "sx_live_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456";
    const request = (key: string, path = "/resolve") => localRequest(server.port, path,
      {Origin: origin, "Content-Type": "application/json", "X-SurdAI-Key": key},
      JSON.stringify({source: "银行发通知", external: true}));
    expect((await request(valid)).status).toBe(200);
    expect(seen).toEqual([valid]);
    expect((await request("invalid")).status).toBe(400);
    expect((await request(valid, "/segment")).status).toBe(400);
    expect(seen).toEqual([valid]);
  } finally {
    await server.close();
  }
});

it("rejects oversized streamed responses and malformed question input without leaking secrets", async () => {
  const r = await createSimplexProvider({
    token: "test",
    fetch: async () =>
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(new Uint8Array(140000));
            c.close();
          },
        }),
      ),
  })([a]);
  expect(r.diagnostics[0].code).toBe("provider-response-too-large");
  const fetcher = vi.fn(async () => new Response("{}"));
  expect(
    (
      await createSimplexProvider({ token: "test", fetch: fetcher })([
        null as any,
      ])
    ).diagnostics[0].code,
  ).toBe("provider-invalid-request");
  expect(fetcher).not.toHaveBeenCalled();
});
it("cancels during streaming and enforces timeout through response body reading", async () => {
  const abort = new AbortController();
  const provider = createSimplexProvider({
    token: "test",
    timeoutMs: 30,
    fetch: async () => new Response(new ReadableStream({ start() {} })),
  });
  const result = provider([a], abort.signal);
  abort.abort();
  expect((await result).diagnostics[0].code).toBe("provider-cancelled");
  expect((await provider([a])).diagnostics[0].code).toBe("provider-timeout");
});
it("validates configured origins and rejects rebinding aliases and invalid JSON option shapes", async () => {
  await expect(
    startLocalServer({
      port: 0,
      origins: ["https://evil.example"],
      provider: createSimplexProvider(),
      configured: false,
    }),
  ).rejects.toThrow();
  const server = await startLocalServer({
    port: 0,
    provider: createSimplexProvider(),
    configured: false,
  });
  try {
    const good = {
      Origin: "http://127.0.0.1:5173",
      "Content-Type": "application/json",
    };
    expect(
      (
        await localRequest(server.port, "/health", {
          Host: `localhost:${server.port}`,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await localRequest(
          server.port,
          "/resolve",
          good,
          JSON.stringify({ source: "hi", options: { analyze: "bad" } }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await localRequest(
          server.port,
          "/resolve",
          good,
          JSON.stringify({
            source: "hi",
            manual: { documentSource: "hi", resolutions: [null] },
          }),
        )
      ).status,
    ).toBe(400);
    const preflight = await localRequest(
      server.port,
      "/resolve",
      {
        Origin: good.Origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
      undefined,
      "OPTIONS",
    );
    expect(preflight.status).toBe(200);
    expect(preflight.headers["access-control-allow-origin"]).toBe(good.Origin);
    const layout = await localRequest(
      server.port,
      "/resolve",
      good,
      JSON.stringify({
        source: "123456",
        external: false,
        options: { columns: 2, paragraphIndent: 0 },
      }),
    );
    expect(layout.body.status).toMatchObject({
      semanticComplete: true,
      layoutComplete: false,
    });
    expect(layout.body.conversion.unicode).toBe("");
  } finally {
    await server.close();
  }
});
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
describe("compiled startup", () => {
beforeAll(() => {
  execFileSync(
    process.execPath,
    ["node_modules/typescript/bin/tsc", "-p", "apps/api/tsconfig.json"],
    { cwd: process.cwd(), stdio: "pipe" },
  );
}, 120000);
it("loads only a synthetic server env file and honors process override", async () => {
  const directory = mkdtempSync(join(tmpdir(), "horizon-env-test-")),
    envFile = join(directory, ".env.local");
  writeFileSync(
    envFile,
    "SIMPLEX_API_TOKEN=SYNTHETIC_TEST_ONLY\nHORIZON_API_PORT=0\n",
  );
  try {
    for (const override of [undefined, ""]) {
      const env = { ...process.env };
      delete env.SIMPLEX_API_TOKEN;
      delete env.HORIZON_API_PORT;
      delete env.HORIZON_UI_ORIGINS;
      delete env.HORIZON_SEGMENT_URL;
      if (override !== undefined) env.SIMPLEX_API_TOKEN = override;
      const child = spawn(
        process.execPath,
        [
          `--env-file-if-exists=${envFile}`,
          resolve(".local/api/apps/api/src/start.js"),
        ],
        {
          cwd: directory,
          env,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let output = "";
      child.stdout.on("data", (c) => (output += c));
      child.stderr.on("data", (c) => (output += c));
      try {
        const port = await new Promise<number>((res, rej) => {
          const timer = setTimeout(
            () => rej(new Error("Startup timed out")),
            5000,
          );
          child.on("exit", () => {
            clearTimeout(timer);
            rej(new Error("Startup exited"));
          });
          child.stdout.on("data", () => {
            const m = output.match(/127\.0\.0\.1:(\d+)/);
            if (m) {
              clearTimeout(timer);
              res(+m[1]);
            }
          });
        });
        expect((await localRequest(port, "/health")).body).toEqual({
          configured: override === undefined,
          userKeySupported: true,
        });
        expect(output).not.toContain("SYNTHETIC_TEST_ONLY");
      } finally {
        child.kill();
        await new Promise<void>((res) => child.once("exit", () => res()));
      }
    }
  } finally {
    if (
      !resolve(directory).startsWith(
        resolve(tmpdir()) + require("node:path").sep + "horizon-env-test-",
      )
    )
      throw new Error("Unsafe test cleanup path");
    rmSync(directory, { recursive: true, force: true });
  }
}, 15000);
});
it("roundtrips returned decisions through local-only conversion without another provider call", async () => {
  const provider = vi.fn(
    async (
      qs: readonly import("../packages/core/src/ambiguity").Ambiguity[],
    ) => ({
      resolutions: qs.map((q) => ({
        id: q.id,
        choice: "punctuation",
        source: "api" as const,
        probabilities: {
          time: 0,
          ratio: 0,
          punctuation: 1,
          mapping: 0,
          unknown: 0,
        },
      })),
      diagnostics: [],
    }),
  );
  const server = await startLocalServer({
      port: 0,
      provider,
      configured: true,
    }),
    headers = {
      Origin: "http://127.0.0.1:5173",
      "Content-Type": "application/json",
    };
  try {
    const first = await localRequest(
      server.port,
      "/resolve",
      headers,
      JSON.stringify({ source: "12:30" }),
    );
    const second = await localRequest(
      server.port,
      "/convert",
      headers,
      JSON.stringify({
        source: "12:30",
        decisions: first.body.decisions,
        options: { columns: 20 },
      }),
    );
    expect(second.status).toBe(200);
    expect(second.body.encoded.atoms).toEqual(first.body.encoded.atoms);
    expect(provider).toHaveBeenCalledTimes(1);
  } finally {
    await server.close();
  }
});
it("rejects chunked oversized JSON with an HTTP error before any provider call", async () => {
  const provider = vi.fn(async () => ({ resolutions: [], diagnostics: [] })),
    server = await startLocalServer({ port: 0, provider, configured: true });
  try {
    const result = await localRequest(
      server.port,
      "/resolve",
      {
        Origin: "http://127.0.0.1:5173",
        "Content-Type": "application/json",
        "Transfer-Encoding": "chunked",
      },
      JSON.stringify({ source: "x".repeat(140000) }),
    );
    expect(result.status).toBe(413);
    expect(provider).not.toHaveBeenCalled();
  } finally {
    await server.close();
  }
});
it("disconnect propagates cancellation to an in-flight provider without retry", async () => {
  let began!: () => void;
  const started = new Promise<void>((r) => (began = r));
  let cancelled!: () => void;
  const cancellation = new Promise<void>((r) => (cancelled = r));
  const provider = vi.fn(
    async (
      qs: readonly import("../packages/core/src/ambiguity").Ambiguity[],
      signal?: AbortSignal,
    ) => {
      began();
      await new Promise<void>((r) =>
        signal!.addEventListener(
          "abort",
          () => {
            cancelled();
            r();
          },
          { once: true },
        ),
      );
      return { resolutions: [], diagnostics: [] };
    },
  );
  const server = await startLocalServer({
    port: 0,
    provider,
    configured: true,
  });
  try {
    const client = request(
      {
        hostname: "127.0.0.1",
        port: server.port,
        path: "/resolve",
        method: "POST",
        headers: {
          Origin: "http://127.0.0.1:5173",
          "Content-Type": "application/json",
        },
      },
      () => {},
    );
    client.on("error", () => {});
    client.end(JSON.stringify({ source: "12:30" }));
    await started;
    client.destroy();
    await cancellation;
    expect(provider).toHaveBeenCalledTimes(1);
  } finally {
    await server.close();
  }
});
it("validates the complete paid request before fetch and sanitizes network failures", async () => {
  const fetcher = vi.fn(async () => {
      throw new Error("SENSITIVE_NETWORK_DETAILS");
    }),
    provider = createSimplexProvider({ token: "test", fetch: fetcher });
  for (const qs of [
    null,
    Array(65).fill(a),
    [{ ...a, context: "x".repeat(129) }],
    [{ ...a, candidates: [{ id: "time", description: "time" }] }],
  ])
    expect((await provider(qs as any)).diagnostics[0].code).toBe(
      "provider-invalid-request",
    );
  expect(fetcher).not.toHaveBeenCalled();
  const result = await provider([a]);
  expect(result.diagnostics[0].code).toBe("provider-network-error");
  expect(JSON.stringify(result)).not.toContain("SENSITIVE");
});
it.each([false, true])(
  "transport rejects conflicting duplicate IDs in either order (reverse=%s)",
  async (reverse) => {
    const server = await startLocalServer({
      port: 0,
      provider: createSimplexProvider(),
      configured: false,
    });
    try {
      const source = "12:30",
        headers = {
          Origin: "http://127.0.0.1:5173",
          "Content-Type": "application/json",
        },
        id = (
          await localRequest(
            server.port,
            "/resolve",
            headers,
            JSON.stringify({ source }),
          )
        ).body.ambiguities[0].id;
      const resolutions = [
        { id, choice: "ratio", source: "manual" },
        {
          id,
          choice: "punctuation",
          source: "api",
          probabilities: {
            time: 0,
            ratio: 0,
            punctuation: 1,
            mapping: 0,
            unknown: 0,
          },
        },
      ];
      if (reverse) resolutions.reverse();
      for (const [route, field] of [
        ["/convert", "decisions"],
        ["/resolve", "manual"],
      ])
        expect(
          (
            await localRequest(
              server.port,
              route,
              headers,
              JSON.stringify({
                source,
                [field]: { documentSource: source, resolutions },
              }),
            )
          ).status,
        ).toBe(400);
    } finally {
      await server.close();
    }
  },
);
it.each([
  "provider-unconfigured",
  "provider-timeout",
  "provider-http-503",
  "ambiguity-low-confidence-or-rule-conflict",
])(
  "reusable decisions preserve safe fallback %s through local conversion",
  async (code) => {
    const provider = vi.fn(async () => ({
        resolutions: [],
        diagnostics: [
          {
            code,
            severity: "warning" as const,
            span: { start: 0, end: 0 },
            message: "Safe local message",
          },
        ],
      })),
      server = await startLocalServer({ port: 0, provider, configured: false });
    const headers = {
      Origin: "http://127.0.0.1:5173",
      "Content-Type": "application/json",
    };
    try {
      const first = await localRequest(
        server.port,
        "/resolve",
        headers,
        JSON.stringify({ source: "12:30" }),
      );
      const second = await localRequest(
        server.port,
        "/convert",
        headers,
        JSON.stringify({
          source: "12:30",
          decisions: first.body.decisions,
          options: { columns: 20 },
        }),
      );
      expect(second.status).toBe(200);
      expect(second.body.status.providerFallback).toBe(true);
      const dedup = await localRequest(
        server.port,
        "/convert",
        headers,
        JSON.stringify({
          source: "12:30",
          decisions: {
            documentSource: "12:30",
            resolutions: [],
            fallbackCodes: [code, code],
          },
        }),
      );
      expect(dedup.status).toBe(200);
      expect(dedup.body.decisions.fallbackCodes).toEqual([code]);
      expect(
        second.body.encoded.diagnostics.some((d: any) => d.code === code),
      ).toBe(true);
      expect(provider).toHaveBeenCalledTimes(1);
      for (const fallbackCodes of [
        ["arbitrary-secret-message"],
        [{ code, message: "untrusted" }],
        Array(65).fill(code),
      ])
        expect(
          (
            await localRequest(
              server.port,
              "/convert",
              headers,
              JSON.stringify({
                source: "12:30",
                decisions: {
                  documentSource: "12:30",
                  resolutions: [],
                  fallbackCodes,
                },
              }),
            )
          ).status,
        ).toBe(400);
    } finally {
      await server.close();
    }
  },
);

it("HTTP document interpretation shares bare islands, source and deterministic offline decisions", async () => {
  const server = await startLocalServer({
    port: 0,
    provider: createSimplexProvider(),
    configured: false,
  });
  try {
    const source = String.raw`会议12:30，计算\frac{13}{28}，反应\ce{H2}后`;
    const headers = {
      Origin: "http://127.0.0.1:5173",
      "Content-Type": "application/json",
    };
    const resolved = await localRequest(
      server.port,
      "/resolve",
      headers,
      JSON.stringify({ source }),
    );
    expect(resolved.status).toBe(200);
    const body = resolved.body;
    const reused = await localRequest(
      server.port,
      "/convert",
      headers,
      JSON.stringify({ source, decisions: body.decisions }),
    );
    expect(reused.status).toBe(200);
    expect(reused.body.encoded.document.source).toBe(source);
    expect(reused.body.encoded.document.nodes.map((n: any) => n.kind)).toEqual([
      "text",
      "bare-math",
      "text",
      "chemistry",
      "text",
    ]);
    expect(reused.body.encoded.atoms).toEqual(body.encoded.atoms);
    expect(reused.body.status.providerFallback).toBe(
      body.status.providerFallback,
    );
  } finally {
    await server.close();
  }
});
it('accepts strict independent domain flags and rejects invalid manual phonotactics', async () => {
 const server = await startLocalServer({port:0, configured:false,provider:createSimplexProvider()});
 try {
  const headers={Origin:'http://127.0.0.1:5173','Content-Type':'application/json'};
  const source=String.raw`前\frac{1}{2}后\ce{H2O}尾`;
  const valid=await localRequest(server.port,'/resolve',headers,JSON.stringify({source,options:{recognizeMath:false,recognizeChemistry:true},external:false}));
  expect(valid.status).toBe(200);expect(valid.body.encoded.document.nodes.some((n:any)=>n.kind==='chemistry')).toBe(true);
  expect(valid.body.encoded.document.nodes.some((n:any)=>n.kind==='bare-math')).toBe(false);
  for(const flag of ['recognizeMath','recognizeChemistry'])expect((await localRequest(server.port,'/resolve',headers,JSON.stringify({source,options:{[flag]:'false'},external:false}))).status).toBe(400);
  for(const reading of ['fiong2','küe3','xi1 an1'])expect((await localRequest(server.port,'/resolve',headers,JSON.stringify({source:'西',options:{overrides:[{start:0,end:1,readings:[reading]}]},external:false}))).status).toBe(400);
 } finally {await server.close();}
});
