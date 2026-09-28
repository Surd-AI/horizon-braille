import { describe, it, expect, vi } from "vitest";
import {
  collectAmbiguities,
  resolveAmbiguities,
  convertWithResolutions,
} from "../packages/core/src/ambiguity";
import {
  encodeDocument,
  reflowExistingAtoms,
} from "../packages/core/src/convert";

describe("constrained decisions", () => {
  it("uses each colon local context without a whole-document ratio switch", async () => {
    const r = await resolveAmbiguities("比例12:30；会议15:00");
    expect(r.resolutions.filter((x: any) => x.choice === "ratio")).toHaveLength(
      1,
    );
    expect(r.resolutions.filter((x: any) => x.choice === "time")).toHaveLength(
      1,
    );
  });
  it("manual choices win, grammar avoids paid requests, and reflow never resolves again", async () => {
    const source = "会议12:30",
      a = collectAmbiguities(source).find((x: any) => x.kind === "colon")!;
    expect(a).toBeDefined();
    const provider = vi.fn(async (questions: readonly any[]) => ({
      resolutions: [],
      diagnostics: [],
    }));
    const r = await resolveAmbiguities(source, {
      provider,
      overrides: [{ start: 0, end: 2, readings: ["hui4", "yi4"] }],
      manual: {
        documentSource: source,
        resolutions: [{ id: a.id, choice: "ratio", source: "manual" }],
      },
    });
    expect(r.resolutions.find((x: any) => x.id === a.id)).toMatchObject({
      choice: "ratio",
      source: "manual",
    });
    const e = convertWithResolutions(source, r, {
      overrides: [{ start: 0, end: 2, readings: ["hui4", "yi4"] }],
    });
    reflowExistingAtoms(e, { columns: 20 });
    reflowExistingAtoms(e, { columns: 30 });
    expect(provider).not.toHaveBeenCalled();
  });
  it("honors explicit preservation and normalization while retaining original spans", async () => {
    const source = "会议12:30",
      r = await resolveAmbiguities(source);
    const disabled = convertWithResolutions(source, r, {timePolicy:"preserve"});
    expect(
      disabled.diagnostics.some(
        (x: any) => x.code === "ambiguity-time-unsupported",
      ),
    ).toBe(true);
    const e = convertWithResolutions(source, r, {
      timePolicy: "normalize-hours-minutes",
    });
    expect(e.document.source).toBe(source);
    expect(e.atoms).not.toEqual(encodeDocument(source).atoms);
    expect(
      e.diagnostics.some((x: any) => x.code === "ambiguity-time-normalized"),
    ).toBe(true);
    expect(
      e.atoms.every(
        (a: any) => a.span.start >= 0 && a.span.end <= source.length,
      ),
    ).toBe(true);
  });
  it.each(["重量", "$\\text{重量}$", "\\ce{C ->[重量] O}"])(
    "resolves real polyphonic cells preserving word boundaries in %s",
    async (source) => {
      const before = encodeDocument(source),
        a = collectAmbiguities(before).find(
          (x: any) =>
            x.kind === "polyphone" &&
            x.candidates.some((c: any) => c.id === "chong2"),
        )!;
      expect(a).toBeDefined();
      const r = await resolveAmbiguities(source, {
        manual: {
          documentSource: source,
          resolutions: [{ id: a.id, choice: "chong2", source: "manual" }],
        },
      });
      const after = convertWithResolutions(source, r);
      expect(after.atoms).not.toEqual(before.atoms);
      expect(after.metadata.chineseWords.map((w: any) => w.span)).toEqual(
        before.metadata.chineseWords.map((w) => w.span),
      );
      expect(
        after.metadata.chineseWords
          .flatMap((w: any) => w.syllables)
          .find((s: any) => s.span.start === a.span.start),
      ).toMatchObject({ reading: "chong2", resolutionSource: "manual" });
    },
  );
  it("exposes pending unknown, rejects stale decisions, and caps one paid pass at 64", async () => {
    const source = Array(70).fill("12:30").join(";"),
      provider = vi.fn(async (questions: readonly any[]) => ({
        resolutions: [],
        diagnostics: [],
      }));
    const r = await resolveAmbiguities(source, { provider });
    expect(provider).toHaveBeenCalledTimes(1);
    expect(provider.mock.calls[0][0]).toHaveLength(64);
    expect(r.diagnostics.some((d: any) => d.code === "ambiguity-budget")).toBe(
      true,
    );
    expect(
      convertWithResolutions(source + "x", r).diagnostics.some(
        (d: any) => d.code === "ambiguity-stale",
      ),
    ).toBe(true);
    expect(convertWithResolutions(source, r).complete).toBe(false);
  });
});

it("prose punctuation emits one colon, not duplicate replacement of its synthetic blank", async () => {
  const source = "12:30",
    a = collectAmbiguities(source)[0],
    r = await resolveAmbiguities(source, {
      manual: {
        documentSource: source,
        resolutions: [{ id: a.id, choice: "punctuation", source: "manual" }],
      },
    });
  const e = convertWithResolutions(source, r);
  expect(
    e.atoms.filter((a) => a.kind === "cell" && a.ruleId === "GF0019-2018-8"),
  ).toHaveLength(1);
});
it.each(["比分3:2", "时长12:30", "会议比例12:30", "会议99:99"])(
  "does not accept model confidence over conflicting or unsupported semantics: %s",
  async (source) => {
    const provider = vi.fn(async (qs: readonly any[]) => ({
      resolutions: qs.map((q) => ({
        id: q.id,
        choice: "time",
        source: "api" as const,
        probabilities: Object.fromEntries(
          q.candidates.map((c: any) => [c.id, c.id === "time" ? 1 : 0]),
        ),
      })),
      diagnostics: [],
    }));
    const r = await resolveAmbiguities(source, { provider });
    expect(r.resolutions.some((r) => r.choice === "time")).toBe(false);
    expect(r.diagnostics.some((d) => d.code === "ambiguity-pending")).toBe(
      true,
    );
  },
);
it("API reading provenance and the other syllable uncertainty survive resolution", async () => {
  const source = "重量",
    before = encodeDocument(source),
    a = collectAmbiguities(before).find((a) => a.span.start === 0)!;
  const r = await resolveAmbiguities(source, {
    provider: async () => ({
      resolutions: [
        {
          id: a.id,
          choice: "chong2",
          source: "api",
          probabilities: { zhong4: 0, chong2: 1, unknown: 0 },
        },
      ],
      diagnostics: [],
    }),
  });
  const e = convertWithResolutions(source, r),
    s = e.metadata.chineseWords.flatMap((w) => w.syllables)[0];
  expect(s).toMatchObject({
    reading: "chong2",
    source: "dictionary",
    resolutionSource: "api",
  });
  expect(
    e.diagnostics.some(
      (d) => d.code === "CHINESE_POLYPHONY" && d.span.start === 0,
    ),
  ).toBe(false);
  expect(
    e.diagnostics.some(
      (d) => d.code === "CHINESE_POLYPHONY" && d.span.start === 1,
    ),
  ).toBe(true);
});
it("actual late cancellation cannot apply returned provider answers", async () => {
  const abort = new AbortController();
  const r = await resolveAmbiguities("12:30", {
    signal: abort.signal,
    provider: async (qs) => {
      abort.abort();
      return {
        resolutions: qs.map((q) => ({
          id: q.id,
          choice: "time",
          source: "api",
          probabilities: {
            time: 1,
            ratio: 0,
            punctuation: 0,
            mapping: 0,
            unknown: 0,
          },
        })),
        diagnostics: [],
      };
    },
  });
  expect(r.resolutions).toEqual([]);
  expect(r.diagnostics.some((d) => d.code === "provider-cancelled")).toBe(true);
});
it("does not discard mathematical scope markers during time normalization", async () => {
  const source = "会议$12:30$",
    r = await resolveAmbiguities(source),
    before = encodeDocument(source),
    e = convertWithResolutions(source, r, {
      timePolicy: "normalize-hours-minutes",
    });
  expect(e.atoms).toEqual(before.atoms);
  expect(
    e.diagnostics.some((d) => d.code === "ambiguity-time-scope-unsupported"),
  ).toBe(true);
});
it("confirmed mathematical ratio clears only that ambiguity and its placeholder", async () => {
  const source = "$12:30$",
    a = collectAmbiguities(source).find((a) => a.kind === "colon")!,
    r = await resolveAmbiguities(source, {
      manual: {
        documentSource: source,
        resolutions: [{ id: a.id, choice: "ratio", source: "manual" }],
      },
    });
  const e = convertWithResolutions(source, r);
  expect(e.diagnostics.some((d) => d.code === "math-colon-ambiguous")).toBe(
    false,
  );
  expect(e.atoms.some((a) => a.ruleId === "unhandled-placeholder")).toBe(false);
  expect(e.complete).toBe(true);
});
it("does not rewrite math punctuation across framing markers", async () => {
  const source = "你$12:30$",
    a = collectAmbiguities(source).find((a) => a.kind === "colon")!,
    r = await resolveAmbiguities(source, {
      manual: {
        documentSource: source,
        resolutions: [{ id: a.id, choice: "punctuation", source: "manual" }],
      },
    });
  const e = convertWithResolutions(source, r);
  expect(e.atoms).toEqual(encodeDocument(source).atoms);
  expect(
    e.diagnostics.some(
      (d) => d.code === "ambiguity-punctuation-scope-unsupported",
    ),
  ).toBe(true);
});
it("converts a long offline ambiguity list while preserving every pending source span", async () => {
  const source = Array(5000).fill("12:30").join(";"),
    r = await resolveAmbiguities(source);
  const e = convertWithResolutions(source, r);
  expect(r.ambiguities).toHaveLength(5000);
  expect(e.document.source).toBe(source);
  expect(e.diagnostics.some((d) => d.code === "ambiguity-budget")).toBe(true);
});
it.each(["会议12:30:99", "会议12:30.5"])(
  "does not normalize partial or fractional clock tokens: %s",
  async (source) => {
    const r = await resolveAmbiguities(source),
      e = convertWithResolutions(source, r, {
        timePolicy: "normalize-hours-minutes",
      });
    expect(
      e.diagnostics.some((d) => d.code === "ambiguity-time-normalized"),
    ).toBe(false);
    expect(e.complete).toBe(false);
  },
);
it("grammar resolution avoids external work and exposes heuristic attribution", async () => {
  const provider = vi.fn(async () => ({ resolutions: [], diagnostics: [] })),
    r = await resolveAmbiguities("比例12:30", { provider });
  expect(provider).not.toHaveBeenCalled();
  expect(r.resolutions.find((r) => r.choice === "ratio")?.source).toBe(
    "heuristic",
  );
});
it("a later API selection cannot override an already human-resolved reading or boundary", async () => {
  const source = "重量",
    before = await resolveAmbiguities(source),
    id = before.ambiguities.find((a) => a.span.start === 0)!.id;
  const e = convertWithResolutions(
    source,
    {
      documentSource: source,
      resolutions: [
        {
          id,
          choice: "zhong4",
          source: "api",
          probabilities: { zhong4: 1, chong2: 0, unknown: 0 },
        },
      ],
    },
    { overrides: [{ start: 0, end: 2, readings: ["chong2", "liang4"] }] },
  );
  expect(e.metadata.chineseWords[0]).toMatchObject({
    span: { start: 0, end: 2 },
    source: "manual",
  });
  expect(e.metadata.chineseWords[0].syllables[0]).toMatchObject({
    reading: "chong2",
    source: "manual",
  });
});
it("fullwidth colon uses the same local semantic choices and cells without rewriting source", async () => {
  for (const pair of [
    ["比例12:30", "比例12：30"],
    ["会议12:30", "会议12：30"],
  ]) {
    const [ascii, full] = pair,
      ra = await resolveAmbiguities(ascii),
      rf = await resolveAmbiguities(full);
    expect(rf.ambiguities.filter((a) => a.kind === "colon")).toHaveLength(1);
    expect(
      rf.resolutions
        .filter((r) => ["time", "ratio"].includes(r.choice))
        .map((r) => r.choice),
    ).toEqual(
      ra.resolutions
        .filter((r) => ["time", "ratio"].includes(r.choice))
        .map((r) => r.choice),
    );
    const a = convertWithResolutions(ascii, ra, {
        timePolicy: "normalize-hours-minutes",
      }),
      f = convertWithResolutions(full, rf, {
        timePolicy: "normalize-hours-minutes",
      });
    expect(f.document.source).toBe(full);
    expect(f.atoms.map((x) => (x.kind === "cell" ? x.cells : x.kind))).toEqual(
      a.atoms.map((x) => (x.kind === "cell" ? x.cells : x.kind)),
    );
    expect(f.atoms.map((a) => a.span)).toEqual(a.atoms.map((a) => a.span));
  }
});
it("an invalid explicit clock cannot be reinterpreted as ratio by the provider", async () => {
  const source = "会议99:99";
  const provider = vi.fn(
    async (
      qs: readonly import("../packages/core/src/ambiguity").Ambiguity[],
    ) => ({
      resolutions: qs.map((q) => ({
        id: q.id,
        choice: q.kind === "colon" ? "ratio" : "unknown",
        source: "api" as const,
        probabilities: Object.fromEntries(
          q.candidates.map((c) => [
            c.id,
            c.id === (q.kind === "colon" ? "ratio" : "unknown") ? 1 : 0,
          ]),
        ),
      })),
      diagnostics: [],
    }),
  );
  const r = await resolveAmbiguities(source, { provider });
  expect(r.resolutions.find((r) => r.id.includes("_colon_"))?.choice).toBe(
    "unknown",
  );
  expect(
    provider.mock.calls
      .flatMap((args) => args[0])
      .some((q) => q.kind === "colon"),
  ).toBe(false);
  expect(convertWithResolutions(source, r).complete).toBe(false);
});
it.each([false, true])(
  "conflicting duplicate decisions are rejected independent of order (reverse=%s)",
  async (reverse) => {
    const source = "12:30",
      id = collectAmbiguities(source)[0].id;
    const choices: import("../packages/core/src/ambiguity").Resolution[] = [
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
    if (reverse) choices.reverse();
    const set = { documentSource: source, resolutions: choices },
      e = convertWithResolutions(source, set);
    expect(e.complete).toBe(false);
    expect(
      e.diagnostics.some((d) => d.code === "ambiguity-duplicate-resolution"),
    ).toBe(true);
    expect(e.atoms).toEqual(encodeDocument(source).atoms);
    const provider = vi.fn(async () => ({ resolutions: [], diagnostics: [] })),
      r = await resolveAmbiguities(source, { manual: set, provider });
    expect(r.resolutions).toEqual([]);
    expect(
      r.diagnostics.some((d) => d.code === "ambiguity-duplicate-resolution"),
    ).toBe(true);
    expect(provider).not.toHaveBeenCalled();
  },
);
