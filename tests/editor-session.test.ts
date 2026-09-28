import { test, expect } from "vitest";
import { convert, encodeDocument, reflowExistingAtoms } from "../packages/core/src/convert";
import { EditorSession, executeSemanticJob as executeReal } from "../apps/playground/src/session";
test("literal text mode retains delimiters, line breaks and backslashes without guessing math", () => {
  const source = String.raw`前\(x=1` + "\n" + String.raw`y=2\)后` + "\n\n尾";
  const r = convert(source, { mode: "text" } as any);
  expect(r.document.nodes.map((n) => n.kind)).toEqual([
    "text",
    "line-break",
    "text",
    "paragraph-break",
    "text",
  ]);
  expect(r.document.nodes.map((n) => n.raw).join("")).toBe(source);
  expect(r.document.nodes[0].raw).toBe(String.raw`前\(x=1`);
  expect(convert("x=1").document.nodes[0].kind).toBe("bare-math");
});
test("late semantic worker results cannot replace newer input", async () => {
  const pending: any[] = [];
  const s = new EditorSession(
    (job) => new Promise((resolve) => pending.push({ job, resolve })),
  );
  const a = s.setSource("旧");
  const b = s.setSource("新");
  pending[1].resolve({
    encoded: encodeDocument("新"),
    decisions: { documentSource: "新", resolutions: [] },
    ambiguities: [],
  });
  await b;
  pending[0].resolve({
    encoded: encodeDocument("旧"),
    decisions: { documentSource: "旧", resolutions: [] },
    ambiguities: [],
  });
  await a;
  expect(s.result?.document.source).toBe("新");
});
test("layout while provider pending uses current width and does not resolve again", async () => {
  let finish: any;
  let calls = 0;
  const s = new EditorSession(
    async (job) => ({
      encoded: encodeDocument(job.source, job.options),
      decisions: { documentSource: job.source, resolutions: [] },
      ambiguities: [],
    }),
    async () => {
      calls++;
      return new Promise((r) => (finish = r));
    },
  );
  await s.setSource("天地人天地人天地人");
  const request = s.resolveOnline();
  s.setLayout({ columns: 10, paragraphIndent: 0 });
  finish({ documentSource: s.source, resolutions: [] });
  await request;
  expect(calls).toBe(1);
  expect(s.result?.layoutProfile.columns).toBe(10);
  expect(s.result?.lines.every((x) => x.length <= 10)).toBe(true);
});
test("cancelled provider completion cannot clear a newer request busy state", async () => {
  const pending: ((r: any) => void)[] = [];
  const s = new EditorSession(
    async (job) => ({
      encoded: encodeDocument(job.source, job.options),
      decisions: { documentSource: job.source, resolutions: [] },
      ambiguities: [],
    }),
    async () => new Promise((r) => pending.push(r)),
  );
  await s.setSource("12:30");
  const old = s.resolveOnline();
  s.cancelOnline();
  const next = s.resolveOnline();
  pending[0]({ documentSource: s.source, resolutions: [] });
  await old;
  expect(s.onlineBusy).toBe(true);
  pending[1]({ documentSource: s.source, resolutions: [] });
  await next;
  expect(s.onlineBusy).toBe(false);
});
test("literal text preserves dollar/backslash escapes and source changes clear span overrides", async () => {
  const source = String.raw`\$5 \\server\path`;
  const r = convert(source, { mode: "text" });
  expect(r.document.nodes).toHaveLength(1);
  expect(r.document.nodes[0]).toMatchObject({ kind: "text", text: source });
  const s = new EditorSession(async (job) => ({
    encoded: encodeDocument(job.source, job.options),
    decisions: { documentSource: job.source, resolutions: [] },
    ambiguities: [],
  }));
  await s.setSource("女");
  await s.setOptions({ overrides: [{ start: 0, end: 1, readings: ["nv3"] }] });
  expect(s.result?.metadata.chineseWords[0].source).toBe("manual");
  await s.setSource("儿");
  expect(s.options.overrides).toEqual([]);
  expect(s.result?.metadata.chineseWords[0].source).toBe("proposal");
});
import { collectAmbiguities, convertWithResolutions, resolveAmbiguities, type DecisionSet } from "../packages/core/src/ambiguity";
const readings = (s: EditorSession) => s.result!.metadata.chineseWords.flatMap(w => w.syllables.map(x => x.reading));
for (const origin of ["manual", "api"] as const) {
  test(`${origin} reading and colon decisions survive both tone directions with actual cells`, async () => {
    const source = "银行发12:30";
    const questions = collectAmbiguities(source);
    const chosen: DecisionSet = { documentSource: source, resolutions: questions.filter(a => a.kind === "colon" || a.span.start === 1).map(a => {
      const choice = a.kind === "colon" ? "ratio" : "xing2";
      return { id: a.id, choice, source: origin, probabilities: Object.fromEntries(a.candidates.map(c => [c.id, c.id === choice ? 1 : 0])) };
    }) };
    const s = new EditorSession(executeReal, async () => chosen);
    await s.setSource(source);
    if (origin === "manual") for (const r of chosen.resolutions) await s.choose(r.id, r.choice);
    else await s.resolveOnline();
    const before = s.result!.unicode;
    for (const tones of ["full", "normative"] as const) {
      await s.setOptions({ chinese: { tones } });
      expect(readings(s)).toContain("xing2");
      expect(s.decisions!.resolutions.map(r => r.source)).toEqual([origin, origin]);
      expect(s.result!.unicode).toBe(reflowExistingAtoms(convertWithResolutions(source, chosen, s.options), s.layout).unicode);
      expect(s.result!.unicode).not.toBe(reflowExistingAtoms(convertWithResolutions(source, {documentSource:source,resolutions:[]}, s.options), s.layout).unicode);
      if (tones === "full") expect(s.result!.unicode).not.toBe(before);
      else expect(s.result!.unicode).toBe(before);
    }
    await s.setSource(source + "新");
    expect(s.decisions!.resolutions.some(r => r.source === origin)).toBe(false);
    expect(readings(s)).toContain("hang2");
  });
}
test("candidate-changing options discard inapplicable choices without resurrecting them", async () => {
  const s = new EditorSession(executeReal);
  await s.setSource("银行");
  const a = collectAmbiguities(s.source).find(a => a.span.start === 1)!;
  await s.choose(a.id, "xing2");
  await s.setOptions({overrides:[{start:0,end:2,readings:["yin2","hang2"]}]});
  expect(readings(s)).toEqual(["yin2","hang2"]);
  expect(s.decisions!.resolutions).toEqual([]);
  await s.setOptions({overrides:[]});
  expect(readings(s)).toEqual(["yin2","hang2"]);
  expect(s.decisions!.resolutions).toEqual([]);
});
test("tone change cancels a pending online answer and retains current manual cells", async () => {
  let finish!: (value: DecisionSet) => void;
  let signal!: AbortSignal;
  const s = new EditorSession(executeReal, async (_, abort) => { signal=abort; return new Promise(resolve => finish=resolve); });
  await s.setSource("银行");
  const a = collectAmbiguities(s.source).find(a => a.span.start === 1)!;
  await s.choose(a.id,"xing2");
  const pending = s.resolveOnline();
  await s.setOptions({chinese:{tones:"full"}});
  const cells = s.result!.unicode;
  expect(signal.aborted).toBe(true);
  finish({documentSource:s.source,resolutions:[{id:a.id,choice:"hang2",source:"manual"}]});
  await pending;
  expect(s.result!.unicode).toBe(cells);
  expect(readings(s)).toContain("xing2");
});
