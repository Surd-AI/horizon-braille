import { expect, test, vi } from "vitest";
import { createHanlpSegmenter, segmentDocument } from "../apps/api/src/hanlp-provider";
import { startLocalServer } from "../apps/api/src/server";
import { createSimplexProvider } from "../apps/api/src/simplex-provider";

test("backend transport uses configured loopback and reconstructs every token", async()=>{
  const fetcher=vi.fn(async(_input:any,_init?:any)=>new Response(JSON.stringify({model:"hanlp-fine-test",tokens:[["边长","相等"],["𠮷","中文"]]})));
  const provider=createHanlpSegmenter({url:"http://127.0.0.1:8791/segment",fetch:fetcher});
  expect((await provider(["边长相等","𠮷中文"])).tokens[0]).toEqual(["边长","相等"]);
  expect(fetcher.mock.calls[0][0]).toBe("http://127.0.0.1:8791/segment");
  expect(JSON.parse((fetcher.mock.calls[0] as any)[1].body)).toEqual({texts:["边长相等","𠮷中文"]});
});
test.each([
  {model:"test",tokens:[["边长"]]}, {model:"test",tokens:[["边长相等",""]]},
  {model:"test",tokens:[["篡改"]]}, {model:"test",tokens:[]}, {model:"",tokens:[["边长相等"]]},
])("malformed replies fail closed %j",async payload=>{
  await expect(createHanlpSegmenter({url:"http://127.0.0.1:8791/segment",fetch:async()=>new Response(JSON.stringify(payload))})(["边长相等"])).rejects.toThrow();
});
test("split surrogate tokens, oversized response, timeout, cancellation and nonloopback fail",async()=>{
  // Construct explicit synthetic userinfo without embedding a credential-looking URL.
  const credentialUrl = new URL("http://127.0.0.1/segment");
  credentialUrl.username = "synthetic-test"; credentialUrl.password = "synthetic-test";
  for (const url of ["https://127.0.0.1/segment","http://evil.example/segment",credentialUrl.href,"http://127.0.0.1/segment?x=y"]) {
    const fetcher=vi.fn();await expect(createHanlpSegmenter({url,fetch:fetcher})(["中文"])).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();
  }
  await expect(createHanlpSegmenter({url:"http://127.0.0.1/segment",fetch:async()=>new Response(JSON.stringify({model:"test",tokens:[["\ud842","\udfb7"]]}))})(["𠮷"])).rejects.toThrow();
  await expect(createHanlpSegmenter({url:"http://127.0.0.1/segment",fetch:async()=>new Response(" ".repeat(131073))})(["中文"])).rejects.toThrow();
  const hanging=vi.fn(()=>new Promise<Response>(()=>{}));
  await expect(createHanlpSegmenter({url:"http://127.0.0.1/segment",timeoutMs:10,fetch:hanging})(["中文"])).rejects.toThrow();
  const abort=new AbortController();abort.abort();
  await expect(createHanlpSegmenter({url:"http://127.0.0.1/segment",fetch:hanging})(["中文"],abort.signal)).rejects.toThrow();
});
test("document extraction follows parsed Chinese metadata and absolute UTF16 offsets",async()=>{
  const source=String.raw`😀边长相等$1+2$后\ce{H2O}文`;
  let texts:string[]=[];
  const r=await segmentDocument(source,{},async input=>{
    texts=input;return {model:"test",tokens:input.map(t=>t==="边长相等"?["边长","相等"]:[t])};
  });
  expect(texts).toEqual(["边长相等","后","文"]);
  expect(r.wordBoundaries.slice(0,2)).toEqual([{start:2,end:4},{start:4,end:6}]);
  expect(r.documentSource).toBe(source);
});
test("upstream request size and stalled body are bounded and cancelable",async()=>{
  const fetcher=vi.fn();
  const provider=createHanlpSegmenter({url:"http://127.0.0.1/segment",fetch:fetcher});
  for (const texts of [["中".repeat(4097)],Array(65).fill("中"),Array(3).fill("中".repeat(4000))])
    await expect(provider(texts)).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
  let cancelled=false;
  const stream=new ReadableStream({cancel(){cancelled=true;}});
  await expect(createHanlpSegmenter({url:"http://127.0.0.1/segment",timeoutMs:10,fetch:async()=>new Response(stream)})(["中文"])).rejects.toThrow();
  expect(cancelled).toBe(true);
  const abort=new AbortController();
  const p=createHanlpSegmenter({url:"http://127.0.0.1/segment",fetch:()=>new Promise(()=>{})})(["中文"],abort.signal);
  abort.abort();await expect(p).rejects.toThrow();
});
test("segment route is independent of CD and resolve accepts the same boundaries and tone options",async()=>{
  const cd=vi.fn(createSimplexProvider());
  const server=await startLocalServer({port:0,configured:false,provider:cd,segmenter:async texts=>({model:"test",tokens:texts.map(t=>t==="边长相等"?["边长","相等"]:[t])})});
  const post=(route:string,body:unknown)=>fetch(`http://127.0.0.1:${server.port}${route}`,{method:"POST",headers:{origin:"http://127.0.0.1:5173","content-type":"application/json"},body:JSON.stringify(body)});
  try {
    const response=await post("/segment",{source:"边长相等",options:{chinese:{tones:"full"}}});
    expect(response.status).toBe(200);const segmented=await response.json();expect(cd).not.toHaveBeenCalled();
    const resolved=await post("/resolve",{source:"边长相等",options:{wordBoundaries:segmented.wordBoundaries,chinese:{tones:"full"}},external:false});
    expect(resolved.status).toBe(200);const data=await resolved.json();
    expect(data.encoded.metadata.chineseWords.map((w:any)=>w.raw)).toEqual(["边长","相等"]);
    expect((await post("/segment",{source:"边长",url:"http://evil.example"})).status).toBe(400);
    expect((await post("/resolve",{source:"边长",options:{wordBoundaries:[{start:-1,end:2}]}})).status).toBe(400);
  } finally {await server.close();}
});
