import { expect, it, vi } from "vitest";
import {
  collectAmbiguities,
  resolveAmbiguities,
  convertWithResolutions,
  type Ambiguity,
} from "../packages/core/src/ambiguity";
import { createSimplexProvider } from "../apps/api/src/simplex-provider";

const questionContext = (q: { instructions: string }): string =>
  JSON.parse(q.instructions.split("\n").find((s) => s.startsWith("完整上下文："))!.slice(6));

it.each([
  ["行走经过银行。", [0, 5]],
  ["前文。😀$\\text{行走经过银行}$。", [9, 14]],
  ["甲".repeat(61) + "😀行走经过银行。", [48, 48]],
  ["甲".repeat(13) + "😀" + "甲".repeat(47) + "行走经过银行。", [47, 48]],
])(
  "identifies each repeated target in bounded UTF-16 context: %s",
  (source, starts) => {
    const qs = collectAmbiguities(source as string).filter(
      (q) =>
        q.kind === "polyphone" && q.candidates.some((c) => c.id === "xing2"),
    );
    expect(qs).toHaveLength(2);
    expect(qs.map((q) => q.contextTarget?.start)).toEqual(starts);
    for (const q of qs) {
      expect(q.context.length).toBeLessThanOrEqual(128);
      expect(q.contextTarget).toEqual({
        start: q.contextTarget!.start,
        end: q.contextTarget!.start + 1,
        text: "行",
      });
      expect(
        q.context.slice(q.contextTarget!.start, q.contextTarget!.end),
      ).toBe("行");
      expect((q.context as any).isWellFormed()).toBe(true);
      expect((source as string).slice(q.span.start, q.span.end)).toBe("行");
    }
  },
);

it("crops the right edge without leaking a partial supplementary scalar", () => {
  const source = "行" + "甲".repeat(47) + "😀" + "乙".repeat(60);
  const q = collectAmbiguities(source).find((q) => q.span.start === 0)!;
  expect(q.context).toBe("行" + "甲".repeat(47));
  expect(q.contextTarget).toEqual({ start: 0, end: 1, text: "行" });
});

it("sends cropped mixed Han/LaTeX context with local offsets rather than source offsets", async () => {
  const source =
    "DO_NOT_SEND_PREFIX" + "甲".repeat(70) + "😀$\\text{行走经过银行}$。";
  const qs = collectAmbiguities(source).filter((q) =>
    q.candidates.some((c) => c.id === "xing2"),
  );
  let payload: any;
  const fetcher = vi.fn(async (_url: any, init: any) => {
    payload = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        answers: Object.fromEntries(
          qs.map((q) => [q.id, { choice: "unknown" }]),
        ),
      }),
    );
  });
  await createSimplexProvider({ token: "synthetic", fetch: fetcher })(qs);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(payload)).not.toContain("DO_NOT_SEND_PREFIX");
  expect(qs.map((q) => q.contextTarget)).toEqual([
    { start: 48, end: 49, text: "行" },
    { start: 48, end: 49, text: "行" },
  ]);
  expect(questionContext(payload.questions[qs[0].id]).slice(47, 50)).toBe("{行走");
  expect(questionContext(payload.questions[qs[1].id]).slice(47, 50)).toBe("银行}");
  expect(qs.every((q) => q.span.start > 48)).toBe(true);
});

it("sends explicit targets with reasoning off and uses distinct returned readings for actual cells", async () => {
  // Both 行 targets remain model questions; 银行 is now a local lexical decision.
  const source = "行走经过车行。";
  const fetcher = vi.fn(async (_url: any, init: any) => {
    const payload = JSON.parse(init.body);
    expect(payload.reasoning).toBe(false);
    expect(payload).not.toHaveProperty("reasoning_max_tokens");
    const answers = Object.fromEntries(
      Object.entries(payload.questions).map(([id, question]) => {
        const context = questionContext(question as { instructions: string });
        const marked = (question as { instructions: string }).instructions;
        expect(context).toBe("行走经过车行");
        if (!marked.includes("【行】"))
          return [
            id,
            {
              choice: "unknown",
              probabilities: Object.fromEntries(
                Object.keys(payload.questions[id].criteria).map((c) => [
                  c,
                  c === "unknown" ? 1 : 0,
                ]),
              ),
            },
          ];
        expect(payload.questions[id].instructions).toContain("本题分句");
        const choice = marked.includes("车【行】") ? "hang2" : "xing2";
        return [
          id,
          {
            choice,
            probabilities: Object.fromEntries(
              Object.keys(payload.questions[id].criteria).map((c) => [
                c,
                c === choice ? 1 : 0,
              ]),
            ),
          },
        ];
      }),
    );
    return new Response(JSON.stringify({ answers }));
  });
  const resolved = await resolveAmbiguities(source, {
    provider: createSimplexProvider({ token: "synthetic", fetch: fetcher }),
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(
    resolved.resolutions
      .filter((r) => r.choice !== "unknown")
      .map((r) => r.choice),
  ).toEqual(["xing2", "hang2"]);
  const encoded = convertWithResolutions(source, resolved);
  const syllables = encoded.metadata.chineseWords
    .flatMap((w) => w.syllables)
    .filter((s) => s.raw === "行");
  expect(syllables.map((s) => s.reading)).toEqual(["xing2", "hang2"]);
  const cells = (start: number) =>
    encoded.atoms
      .filter((a) => a.kind === "cell" && a.span.start === start)
      .map((a) => (a.kind === "cell" ? a.cells : ""))
      .join("");
  expect(cells(0)).not.toBe(cells(5));
  expect(encoded.document.source).toBe(source);
});

it("makes repeated colons independently addressable in the outbound batch", async () => {
  const qs = collectAmbiguities("😀12:30，3:2。").filter(
    (q) => q.kind === "colon",
  );
  const fetcher = vi.fn(async (_url: any, init: any) => {
    const p = JSON.parse(init.body);
    expect(qs.map((q) => q.contextTarget)).toEqual([
      { start: 4, end: 5, text: ":" },
      { start: 9, end: 10, text: ":" },
    ]);
    expect(p.questions[qs[0].id].instructions).toContain("😀12【:】30");
    expect(p.questions[qs[1].id].instructions).toContain("3【:】2");
    return new Response(
      JSON.stringify({
        answers: Object.fromEntries(
          qs.map((q, i) => [
            q.id,
            {
              choice: i ? "ratio" : "time",
              probabilities: Object.fromEntries(
                q.candidates.map((c) => [
                  c.id,
                  c.id === (i ? "ratio" : "time") ? 1 : 0,
                ]),
              ),
            },
          ]),
        ),
      }),
    );
  });
  const r = await resolveAmbiguities("😀12:30，3:2。", {
    provider: createSimplexProvider({ token: "synthetic", fetch: fetcher }),
  });
  expect(
    r.resolutions.filter((r) => r.id.includes("colon")).map((r) => r.choice),
  ).toEqual(["time", "ratio"]);
});

it.each(["，", ",", "；", ";", "。", "\n", "\r\n"])(
  "uses target-local grammar across %j",
  async (separator) => {
    const r = await resolveAmbiguities(`时间12:30${separator}比例3:2。`);
    expect(
      r.ambiguities
        .filter((q) => q.kind === "colon")
        .map((q) => r.resolutions.find((r) => r.id === q.id)?.choice),
    ).toEqual(["time", "ratio"]);
  },
);

it.each(["时间：12:30，比例：3:2。", "时间:12:30,比例:3:2。"])(
  "separates label punctuation from numeric colons: %s",
  async (source) => {
    const r = await resolveAmbiguities(source);
    expect(
      r.resolutions.filter((r) => r.id.includes("colon")).map((r) => r.choice),
    ).toEqual(["punctuation", "time", "punctuation", "ratio"]);
  },
);

it.each(["时间99:99", "时长12:99", "比分3:2", "会议比例12:30", "会议12:30:99"])(
  "keeps unsafe first clause pending: %s",
  async (first) => {
    const r = await resolveAmbiguities(`${first}，比例3:2。`);
    expect(
      r.resolutions.filter((r) => r.id.includes("colon")).map((r) => r.choice),
    ).toEqual(
      first.includes("12:30:45")
        ? ["unknown", "unknown", "ratio"]
        : ["unknown", "ratio"],
    );
  },
);

it.each([
  undefined,
  null,
  { start: -1, end: 1, text: ":" },
  { start: 2.5, end: 3, text: ":" },
  { start: 2, end: 200, text: ":" },
  { start: 2, end: 2, text: "" },
  { start: 2, end: 3, text: "x" },
  { start: 0, end: 1, text: "\ud83d" },
  { start: 1, end: 2, text: "\ude00" },
  { start: 0, end: 2, text: "😀" },
])(
  "rejects missing or malformed target before fetching: %j",
  async (contextTarget) => {
    const q = {
      ...collectAmbiguities("😀12:30").find((q) => q.kind === "colon")!,
      contextTarget,
    } as Ambiguity;
    const fetcher = vi.fn(async () => new Response("{}"));
    const r = await createSimplexProvider({
      token: "synthetic",
      fetch: fetcher,
    })([q]);
    expect(r.diagnostics[0]?.code).toBe("provider-invalid-request");
    expect(fetcher).not.toHaveBeenCalled();
  },
);
