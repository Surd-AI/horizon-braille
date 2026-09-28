import { expect, test, vi } from "vitest";
import { convert } from "../packages/core/src/convert";
import { analyzeChineseDetailed } from "../packages/core/src/language/chinese";
import { EditorSession, executeSemanticJob } from "../apps/playground/src/session";

const words = (source: string, options = {}) => convert(source, options).metadata.chineseWords.filter(w => w.kind === "chinese");
test("external boundaries remain source-aligned proposals and preserve manual readings", () => {
  const source = "😀边长相等，后$1+2$前";
  const wordBoundaries = [{start:2,end:4},{start:4,end:6}];
  const result = words(source, {wordBoundaries});
  expect(result.slice(0,2).map(w => w.raw)).toEqual(["边长","相等"]);
  expect(result[0]).toMatchObject({source:"proposal",span:{start:2,end:4}});
  expect(result[0].syllables.map(s=>s.reading)).toEqual(["bian1","chang2"]);
  for (const w of result) expect(source.slice(w.span.start,w.span.end)).toBe(w.raw);
  const manual = words(source,{wordBoundaries,overrides:[{start:3,end:4,readings:["zhang3"]}]});
  expect(manual.find(w=>w.source==="manual")?.syllables[0].reading).toBe("zhang3");
  expect(manual.some(w=>w.raw==="边长")).toBe(false);
  expect(manual.some(w=>w.raw==="相等")).toBe(true);
  expect(analyzeChineseDetailed("边长相等",[],9,undefined,[{start:9,end:11},{start:11,end:13}]).words.map(w=>w.raw)).toEqual(["边长","相等"]);
});
test.each([
  [{start:1,end:4}], [{start:-1,end:2}], [{start:2,end:99}],
  [{start:2,end:2}], [{start:2.5,end:4}], [{start:2,end:5},{start:4,end:6}],
  [{start:4,end:6},{start:2,end:4}], [{start:2,end:7}], [{start:8,end:15}],
  [{start:2,end:4}], [{start:2,end:3},{start:4,end:6}],
].map(wordBoundaries => ({wordBoundaries})))("invalid spans fail closed without losing source: %j", ({wordBoundaries}) => {
  const source="😀边长相等，后$1+2$前";
  const r=convert(source,{wordBoundaries});
  expect(r.diagnostics.some(d=>d.code==="CHINESE_INVALID_WORD_BOUNDARIES")).toBe(true);
  expect(r.metadata.chineseWords.map(w=>w.raw)).toEqual(convert(source).metadata.chineseWords.map(w=>w.raw));
});
test("external boundaries are honored inside explicit Han text but not formula syntax",()=>{
  const source=String.raw`前$\text{边长相等}$后\ce{H2O}`;
  const at=source.indexOf("边长");
  const r=words(source,{wordBoundaries:[{start:at,end:at+2},{start:at+2,end:at+4}]});
  expect(r.some(w=>w.raw==="边长")).toBe(true);
  expect(r.some(w=>w.raw==="相等")).toBe(true);
});
test("external partitions retain checked GF repetition rules but remain proposals",()=>{
  const r=convert("研究研究",{wordBoundaries:[{start:0,end:4}]});
  expect(r.metadata.chineseWords.map(w=>[w.raw,w.source])).toEqual([["研究","proposal"],["研究","proposal"]]);
  expect(r.diagnostics.some(d=>d.code==="CHINESE_INVALID_WORD_BOUNDARIES")).toBe(false);
  expect(r.diagnostics.find(d=>d.code==="CHINESE_JOIN_PROPOSAL")?.message).toContain("Not complete grammatical analysis");
  expect(convert("研究研究").metadata.chineseWords.map(w=>w.raw)).toEqual(["研究","研究"]);
});
test.each(["妈妈","我们","来来往往","说说笑笑","清清楚楚","弯弯曲曲"])("external split %s retains existing bounded joins",raw=>{
  const wordBoundaries=[...raw].map((_,i)=>({start:i,end:i+1}));
  const r=convert(raw,{wordBoundaries});
  expect(r.metadata.chineseWords.map(w=>w.raw)).toEqual([raw]);
  expect(r.metadata.chineseWords[0].source).toBe("proposal");
  expect(r.diagnostics.some(d=>d.code==="CHINESE_INVALID_WORD_BOUNDARIES")).toBe(false);
});
test("checked AABB extraction only changes manual gaps and preserves model/source offsets",()=>{
  const source="😀每年来来往往清清楚楚很好";
  const r=words(source,{wordBoundaries:[{start:2,end:source.length}]});
  expect(r.map(w=>w.raw)).toEqual(["每年","来来往往","清清楚楚","很好"]);
  for (const w of r) expect(source.slice(w.span.start,w.span.end)).toBe(w.raw);
  const manual=words("研究研究",{wordBoundaries:[{start:0,end:4}],overrides:[{start:0,end:4,readings:["yan2","jiu1","yan2","jiu1"]}]});
  expect(manual.map(w=>[w.raw,w.source])).toEqual([["研究研究","manual"]]);
  const split=words("来来往往",{wordBoundaries:[{start:0,end:4}],overrides:[{start:0,end:2,readings:["lai2","lai2"]}]});
  expect(split.map(w=>[w.raw,w.source])).toEqual([["来来","manual"],["往往","proposal"]]);
});

test("session applies proposals before CD without changing revision and clears them on source edit",async()=>{
  let seen:any;
  const s=new EditorSession(executeSemanticJob,async job=>{
    seen=job.options;return {documentSource:job.source,resolutions:[]};
  },()=>{},async job=>({documentSource:job.source,model:"test-model",wordBoundaries:[{start:0,end:2},{start:2,end:4}]}));
  await s.setSource("边长相等");
  const revision=s.semanticRevision;
  expect(await s.segmentOnline()).toBe(true);
  expect(s.semanticRevision).toBe(revision);
  expect(s.segmentStatus).toBe("success");
  expect(s.result!.metadata.chineseWords.map(w=>w.raw)).toEqual(["边长","相等"]);
  expect(s.result!.metadata.chineseWords.every(w=>w.source==="proposal")).toBe(true);
  await s.resolveOnline();
  expect(seen.wordBoundaries).toEqual(s.options.wordBoundaries);
  await s.setSource("新内容");
  expect(s.options.wordBoundaries).toBeUndefined();
  expect(s.segmentStatus).toBe("idle");
});
test("failed, stale, canceled segmentation preserves local/manual state",async()=>{
  let finish:any,signal:AbortSignal|undefined;
  const s=new EditorSession(executeSemanticJob,undefined,()=>{},(job,sig)=>{signal=sig;return new Promise(r=>finish=r);});
  await s.setSource("边长相等");
  const pending=s.segmentOnline();
  await s.setOptions({overrides:[{start:0,end:2,readings:["bian1","zhang3"]}]});
  expect(signal?.aborted).toBe(true);
  finish({documentSource:"边长相等",model:"test",wordBoundaries:[{start:0,end:2},{start:2,end:4}]});
  expect(await pending).toBe(false);
  expect(s.result!.metadata.chineseWords[0].source).toBe("manual");
  const invalid=s.segmentOnline();
  finish({documentSource:"different",model:"test",wordBoundaries:[]});
  expect(await invalid).toBe(false);
  expect(s.segmentStatus).toBe("error");
  expect(s.result!.metadata.chineseWords[0].source).toBe("manual");
  const canceled=s.segmentOnline();s.cancelOnline();
  finish({documentSource:s.source,model:"test",wordBoundaries:[]});
  expect(await canceled).toBe(false);expect(s.segmentBusy).toBe(false);
});
test("incomplete proposals and a canceled old request cannot replace a newer segmentation",async()=>{
  const pending: ((r:any)=>void)[]=[];
  const s=new EditorSession(executeSemanticJob,undefined,()=>{},()=>new Promise(r=>pending.push(r)));
  await s.setSource("边长相等，中文");
  const incomplete=s.segmentOnline();
  pending[0]({documentSource:s.source,model:"test",wordBoundaries:[{start:0,end:2},{start:2,end:4}]});
  expect(await incomplete).toBe(false);expect(s.options.wordBoundaries).toBeUndefined();
  const old=s.segmentOnline();s.cancelOnline();const next=s.segmentOnline();
  const reply={documentSource:s.source,model:"test",wordBoundaries:[{start:0,end:2},{start:2,end:4},{start:5,end:7}]};
  pending[1](reply);expect(await old).toBe(false);expect(s.segmentBusy).toBe(true);
  pending[2](reply);expect(await next).toBe(true);expect(s.segmentBusy).toBe(false);
  await s.setOptions({mode:"math"});expect(s.options.wordBoundaries).toBeUndefined();
});
test("session deadline bounds an uncooperative provider and discards a late reply",async()=>{
  let finish:any,signal:AbortSignal|undefined;
  const s=new EditorSession(executeSemanticJob,undefined,()=>{},(_job,sig)=>{signal=sig;return new Promise(r=>finish=r);});
  await s.setSource("边长相等");
  await s.setOptions({overrides:[{start:0,end:2,readings:["bian1","zhang3"]}]});
  const existing=s.result;
  vi.useFakeTimers();
  try {
    const pending=s.segmentOnline();
    await vi.advanceTimersByTimeAsync(15000);
    expect(await pending).toBe(false);
    expect(signal?.aborted).toBe(true);
    expect(s.segmentBusy).toBe(false);expect(s.segmentStatus).toBe("error");
    finish({documentSource:s.source,model:"late",wordBoundaries:[{start:0,end:2},{start:2,end:4}]});
    await Promise.resolve();
    expect(s.result).toBe(existing);expect(s.options.wordBoundaries).toBeUndefined();
    expect(s.result!.metadata.chineseWords[0].source).toBe("manual");
    expect(vi.getTimerCount()).toBe(0);
  } finally {s.dispose();vi.useRealTimers();}
});
test("session deadline also bounds encoding after a successful segmenter reply",async()=>{
  let calls=0;
  const cancel=vi.fn();
  const s=new EditorSession(job=>++calls===1?executeSemanticJob(job):new Promise(()=>{}),undefined,cancel,async job=>({documentSource:job.source,model:"test",wordBoundaries:[{start:0,end:2},{start:2,end:4}]}));
  await s.setSource("边长相等");const existing=s.result;
  cancel.mockClear();
  vi.useFakeTimers();
  try {
    const pending=s.segmentOnline();await vi.advanceTimersByTimeAsync(15000);
    expect(await pending).toBe(false);expect(s.result).toBe(existing);
    expect(s.segmentStatus).toBe("error");expect(s.segmentBusy).toBe(false);
    expect(cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  } finally {s.dispose();vi.useRealTimers();}
});
