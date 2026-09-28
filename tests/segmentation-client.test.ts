import { expect, test, vi } from "vitest";
vi.mock("../apps/playground/src/worker?worker&inline", async () => {
  const {executeSemanticJob} = await import("../apps/playground/src/session");
  return {default: class {
    onmessage?: (event:any)=>void;
    onerror?: ()=>void;
    postMessage({id,job}:any) { void executeSemanticJob(job).then(reply=>this.onmessage?.({data:{id,reply}})); }
    terminate() {}
  }};
});
import { createSession } from "../apps/playground/src/client";

test("custom session segmenter bypasses default transport and preserves zero-argument compatibility",async()=>{
  const provider=vi.fn(async(job:any,signal:AbortSignal)=>{
    expect(signal.aborted).toBe(false);
    return {documentSource:job.source,model:"injected",wordBoundaries:[{start:0,end:2},{start:2,end:4}]};
  });
  const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
  const s=createSession({segmenter:provider});
  try {
    await s.setSource("边长相等");expect(await s.segmentOnline()).toBe(true);
    expect(provider).toHaveBeenCalledOnce();expect(fetcher).not.toHaveBeenCalled();
    expect(s.segmentModel).toBe("injected");
  } finally {s.dispose();vi.unstubAllGlobals();}
});
test("default client shares full semantic settings with segment and resolve transports",async()=>{
  const bodies:any[]=[];
  vi.stubGlobal("fetch",vi.fn(async(url:string,init:any)=>{
    const body=JSON.parse(init.body);bodies.push({url,body});
    return new Response(JSON.stringify(url.endsWith("/segment")
      ? {documentSource:body.source,model:"test",wordBoundaries:[{start:0,end:2},{start:2,end:4}]}
      : {decisions:{documentSource:body.source,resolutions:[]}}));
  }));
  const s=createSession();
  try {
    await s.setSource("边长相等");
    await s.setOptions({chinese:{tones:"full",contractions:false},timePolicy:"preserve",recognizeMath:false});
    expect(await s.segmentOnline()).toBe(true);await s.resolveOnline();
    expect(bodies.map(x=>x.url)).toEqual(["http://127.0.0.1:8787/segment","http://127.0.0.1:8787/resolve"]);
    for (const {body} of bodies) {
      expect(body.options.chinese).toEqual({tones:"full",contractions:false});
      expect(body.options.recognizeMath).toBe(false);expect(body.options.timePolicy).toBe("preserve");
    }
    expect(bodies[1].body.options.wordBoundaries).toEqual(s.options.wordBoundaries);
  } finally {s.dispose();vi.unstubAllGlobals();}
});
test('injected resolver avoids loopback fetch and reports unavailable without discarding local output',async()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 const resolver=vi.fn(async()=>{throw new Error('online-not-configured');});
 const s=createSession({resolver});
 try{await s.setSource('中文');const prior=s.result;await s.resolveOnline();expect(resolver).toHaveBeenCalledOnce();expect(fetcher).not.toHaveBeenCalled();expect(s.result).toBe(prior);expect(s.error).toContain('online-not-configured');}
 finally{s.dispose();vi.unstubAllGlobals();}
});
