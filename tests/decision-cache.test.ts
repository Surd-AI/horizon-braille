import {expect, test, vi} from "vitest";
import {collectAmbiguities, type Ambiguity} from "../packages/core/src/ambiguity";
import {DecisionCache} from "../apps/api/src/decision-cache";

function question(source: string): Ambiguity {
  const result = collectAmbiguities(source).find(a => a.kind === "polyphone" && source.slice(a.span.start, a.span.end) === "行");
  if (!result) throw new Error("missing test ambiguity");
  return result;
}

test("reuses a validated model answer when only another sentence changes", async () => {
  const provider = vi.fn(async (questions: readonly Ambiguity[]) => ({
    resolutions: questions.map(q => ({id:q.id,choice:"hang2",source:"api" as const,confidence:0.8})),
    diagnostics: [], trace: {requestSent:true,outcome:"complete"},
  }));
  const cache = new DecisionCache();
  const first = question("银行。第一句。");
  const second = question("银行。第二句。");
  expect(first.id).not.toBe(second.id);
  expect((await cache.providerForRequest(provider)([first])).resolutions[0].id).toBe(first.id);
  const reply = await cache.providerForRequest(provider)([second]);
  expect(provider).toHaveBeenCalledTimes(1);
  expect(reply.resolutions[0]).toMatchObject({id:second.id,choice:"hang2",source:"api"});
  expect(reply.trace).toMatchObject({requestSent:false,outcome:"cache-hit"});
});

test("changed sentence context and weak answers require a fresh model request", async () => {
  let confidence = 0.49;
  const provider = vi.fn(async (questions: readonly Ambiguity[]) => ({
    resolutions: questions.map(q => ({id:q.id,choice:"hang2",source:"api" as const,confidence})),
    diagnostics: [], trace: {requestSent:true,outcome:"complete"},
  }));
  const cache = new DecisionCache();
  const first = question("银行。尾句。");
  await cache.providerForRequest(provider)([first]);
  confidence = 0.8;
  await cache.providerForRequest(provider)([first]);
  expect(provider).toHaveBeenCalledTimes(2);
  await cache.providerForRequest(provider)([question("银行办事。尾句。")]);
  expect(provider).toHaveBeenCalledTimes(3);
});

test("cache is bounded by time and does not save failed requests", async () => {
  let now = 1000;
  let fail = true;
  const provider = vi.fn(async (questions: readonly Ambiguity[]) => ({
    resolutions: questions.map(q => ({id:q.id,choice:"hang2",source:"api" as const,confidence:0.9})),
    diagnostics: fail ? [{code:"provider-timeout",span:{start:0,end:0},severity:"warning" as const,message:"timeout"}] : [],
    trace: {requestSent:true,outcome:fail ? "provider-timeout" : "complete"},
  }));
  const cache = new DecisionCache(() => now);
  const target = question("银行。");
  await cache.providerForRequest(provider)([target]);
  fail = false;
  await cache.providerForRequest(provider)([target]);
  await cache.providerForRequest(provider)([target]);
  expect(provider).toHaveBeenCalledTimes(2);
  now += 21 * 60 * 1000;
  await cache.providerForRequest(provider)([target]);
  expect(provider).toHaveBeenCalledTimes(3);
});
