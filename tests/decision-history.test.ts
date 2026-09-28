import {test,expect} from 'vitest';
import {resolveAmbiguities} from '../packages/core/src/ambiguity';
import {createSimplexProvider} from '../apps/api/src/simplex-provider';
import {EditorSession,executeSemanticJob} from '../apps/playground/src/session';
test('trace captures exact outbound payload without credentials and retains rejected answers',async()=>{
 // Use an unresolved word: checked lexical entries such as 银行 bypass transport.
 let sent:any;
 const provider=createSimplexProvider({token:'fake-secret',fetch:async(_u,init)=>{sent=JSON.parse(String(init?.body));return new Response(JSON.stringify({answers:Object.fromEntries(Object.entries(sent.questions).map(([id,q]:any)=>[id,{choice:Object.keys(q.criteria)[0],confidence:0.49,probabilities:Object.fromEntries(Object.keys(q.criteria).map((c,i)=>[c,i===0?.6:i===1?.4:0]))}]))}));}});
 const result=await resolveAmbiguities('行走',{provider});
 expect(result.audit?.transport.requestSent).toBe(true);
 expect(result.audit?.transport.questions).toEqual(sent.questions);
 expect(JSON.stringify(result.audit)).not.toContain('fake-secret');
 expect(result.audit?.questions.some(q=>q.model && !q.adopted)).toBe(true);
});
test('history remains canceled and clear cannot resurrect it',async()=>{
 let finish:any;
 const s=new EditorSession(executeSemanticJob,()=>new Promise(r=>finish=r));
 await s.setSource('银行');const pending=s.resolveOnline();
 expect(s.history[0].status).toBe('pending');
 await s.setSource('新的');expect(s.history[0].status).toBe('canceled');
 s.clearHistory();finish({documentSource:'银行',resolutions:[]});await pending;
 expect(s.history).toEqual([]);expect(s.source).toBe('新的');
});
test('unconfigured differs from fetch failures and times are finite',async()=>{
 const {collectAmbiguities}=await import('../packages/core/src/ambiguity');
 const qs=collectAmbiguities('银行');
 const unconfigured=await createSimplexProvider()(qs);
 expect(unconfigured.trace).toMatchObject({requestSent:false,outcome:'provider-unconfigured'});
 for(const status of [401,503]) {
  const r=await createSimplexProvider({token:'secret',fetch:async()=>new Response('opaque-secret-body',{status})})(qs);
  expect(r.trace).toMatchObject({requestSent:true,outcome:`provider-http-${status}`});
  expect(Number.isFinite(r.trace?.durationMs)).toBe(true);
  expect(JSON.stringify(r)).not.toContain('secret');
 }
 const timed=await createSimplexProvider({token:'secret',timeoutMs:1,fetch:()=>new Promise(()=>{})})(qs);
 expect(timed.trace).toMatchObject({requestSent:true,outcome:'provider-timeout'});
});
test('history cap, immutable exports, unknown injected metadata and observer failure',async()=>{
 const s=new EditorSession(executeSemanticJob,async job=>({documentSource:job.source,resolutions:[]}));
 await s.setSource('银行');s.onChange=()=>{throw new Error('observer');};
 for(let i=0;i<22;i++) await s.resolveOnline();
 expect(s.history).toHaveLength(20);expect(s.history[0].audit).toBeUndefined();
 const snapshot=s.exportHistory();await s.setSource('新');
 expect(JSON.parse(snapshot).history[0].source).toBe('银行');
 expect(s.history[0].source).toBe('银行');
});
test('no-provider attempts and failures get separate safe history',async()=>{
 const local=new EditorSession(executeSemanticJob);await local.setSource('银行');await local.resolveOnline();
 expect(local.history[0].audit?.transport.requestSent).toBe(false);
 const failed=new EditorSession(executeSemanticJob,async()=>{throw new Error('private-error-body')});
 await failed.setSource('银行');await failed.resolveOnline();expect(failed.history[0].status).toBe('failed');
 expect(failed.exportHistory()).not.toContain('private-error-body');
});
test('parallel provider traces do not mix payloads; accepted and unknown choices preserved',async()=>{
 const provider=createSimplexProvider({token:'secret',fetch:async(_url,init)=>{
  const payload=JSON.parse(String(init?.body));
  return new Response(JSON.stringify({answers:Object.fromEntries(Object.entries(payload.questions).map(([id,q]:any)=>{
   const choice=q.instructions.includes('行走')?'unknown':Object.keys(q.criteria)[0];
   return [id,{choice,probabilities:Object.fromEntries(Object.keys(q.criteria).map(c=>[c,c===choice?1:0]))}];
  }))}));
 }});
 const [a,b]=await Promise.all([resolveAmbiguities('行走',{provider}),resolveAmbiguities('音乐',{provider})]);
 expect(JSON.stringify(a.audit?.transport.questions)).toContain('行走');expect(JSON.stringify(a.audit?.transport.questions)).not.toContain('音乐');
 expect(a.audit?.questions.some(q=>q.model?.choice==='unknown'&&!q.adopted)).toBe(true);
 expect(b.audit?.questions.some(q=>q.adopted&&q.accepted?.source==='api')).toBe(true);
});
test('manual precedence and bounded details explicitly count omitted questions',async()=>{
 const {collectAmbiguities}=await import('../packages/core/src/ambiguity');const source='银行';const q=collectAmbiguities(source)[0];
 const r=await resolveAmbiguities(source,{manual:{documentSource:source,resolutions:[{id:q.id,choice:q.candidates[0].id,source:'manual'}]}});
 expect(r.audit?.questions.find(x=>x.id===q.id)).toMatchObject({outcome:'manual',adopted:true});
 // Distinct unresolved targets must exercise the provider budget, not local words.
 const budget=await resolveAmbiguities('行。'.repeat(150));
 expect(budget.audit?.questions.length).toBeLessThanOrEqual(128);expect(budget.audit!.omittedQuestions).toBeGreaterThan(0);
 expect(budget.audit!.totalQuestions).toBe(budget.audit!.questions.length+budget.audit!.omittedQuestions);
 expect(budget.audit!.questions.some(q=>q.outcome==='ambiguity-budget')).toBe(true);
});
test('invalid/oversized/network responses log outcome without opaque bodies',async()=>{
 const {collectAmbiguities}=await import('../packages/core/src/ambiguity');const qs=collectAmbiguities('银行');
 const cases:[()=>Promise<Response>,string][]=[
  [async()=>new Response('opaque-invalid'),'provider-invalid-json'],
  [async()=>new Response(JSON.stringify({answers:{x:{choice:'invented'}}})),'provider-invalid-response'],
  [async()=>new Response('opaque',{headers:{'content-length':'200000'}}),'provider-response-too-large'],
  [async()=>{throw new Error('opaque-network-secret')},'provider-network-error'],
 ];
 for(const [fetcher,outcome] of cases){const r=await createSimplexProvider({token:'secret',fetch:fetcher})(qs);expect(r.trace).toMatchObject({requestSent:true,outcome});expect(JSON.stringify(r)).not.toContain('opaque');}
});
test('options cancel immediately, repeated pending clicks do not duplicate, completed clear stable',async()=>{
 let finish:any;const s=new EditorSession(executeSemanticJob,()=>new Promise(r=>finish=r));
 await s.setSource('银行');const request=s.resolveOnline();await s.resolveOnline();expect(s.history).toHaveLength(1);
 await s.setOptions({recognizeMath:false});expect(s.history[0].status).toBe('canceled');expect(s.history[0].options.recognizeMath).toBeUndefined();
 const before=s.result!.unicode;finish({documentSource:'银行',resolutions:[]});await request;expect(s.result!.unicode).toBe(before);
 const next=s.resolveOnline();s.clearHistory();finish({documentSource:'银行',resolutions:[]});await next;expect(s.history).toEqual([]);
});
test('HTTP audit is separate and cannot be resubmitted as DecisionSet',async()=>{
 const {startLocalServer}=await import('../apps/api/src/server');
 const server=await startLocalServer({port:0,configured:false,provider:createSimplexProvider()});
 try{
  const call=(path:string,body:unknown)=>fetch(`http://127.0.0.1:${server.port}${path}`,{method:'POST',headers:{Origin:'http://127.0.0.1:5173','Content-Type':'application/json'},body:JSON.stringify(body)});
  const response=await call('/resolve',{source:'银行'});const data=await response.json();
  expect(response.status).toBe(200);expect(data.audit.transport.requestSent).toBe(false);expect(data.decisions.audit).toBeUndefined();
  const bad=await call('/convert',{source:'银行',decisions:{...data.decisions,audit:data.audit}});expect(bad.status).toBe(400);
 }finally{await server.close();}
});
