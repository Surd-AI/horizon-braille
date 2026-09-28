import {test,expect} from 'vitest';
import {startLocalServer} from '../apps/api/src/server';
import {readDecisionResponse} from '../apps/playground/src/decision-stream';
import {EditorSession,executeSemanticJob} from '../apps/playground/src/session';
import {collectAmbiguities,resolveAmbiguities} from '../packages/core/src/ambiguity';

test('HTTP model at 0.5 overrides a clear local rule, below 0.5 does not; manual wins',async()=>{
 const source='会议12:30开始',local=await resolveAmbiguities(source),target=local.ambiguities.find(a=>a.kind==='colon')!;
 expect(local.resolutions.find(r=>r.id===target.id)?.choice).toBe('time');
 let confidence=.5;const asked:string[]=[];
 const server=await startLocalServer({port:0,configured:true,provider:async qs=>{asked.push(...qs.map(q=>q.id));return {resolutions:qs.filter(q=>q.id===target.id).map(q=>({id:q.id,choice:'ratio',source:'api',confidence})),diagnostics:[]};}});
 const request=async(manual?:any)=>{const res=await fetch(`http://127.0.0.1:${server.port}/resolve`,{method:'POST',headers:{Origin:'http://127.0.0.1:5173','Content-Type':'application/json'},body:JSON.stringify({source,stream:true,manual})});return readDecisionResponse(res,new AbortController().signal);};
 try {
  const yes=await request();expect(asked).toContain(target.id);expect(yes.decisions.resolutions.find((r:any)=>r.id===target.id)).toMatchObject({choice:'ratio',source:'api',confidence:.5});
  confidence=.49;const no=await request();expect(no.decisions.resolutions.some((r:any)=>r.id===target.id&&r.choice==='ratio')).toBe(false);
  asked.length=0;confidence=.9;const manual=await request({documentSource:source,resolutions:[{id:target.id,choice:'time',source:'manual'}]});expect(asked).not.toContain(target.id);expect(manual.decisions.resolutions.find((r:any)=>r.id===target.id)).toMatchObject({choice:'time',source:'manual'});
 }finally{await server.close();}
});
test('HTTP sends real counts and first results before next batch completes; failure retains first batch',async()=>{
 let next!:()=>void; const gate=new Promise<void>(r=>next=r);let calls=0;
 const server=await startLocalServer({port:0,configured:true,provider:async qs=>{if(++calls===2){await gate;throw Error('timeout');}return {resolutions:qs.map(q=>({id:q.id,choice:'xing2',source:'api',confidence:.7})),diagnostics:[],trace:{requestSent:true,outcome:'complete'}};}});
 const source='行。'.repeat(35),progress:any[]=[];
 try{const response=await fetch(`http://127.0.0.1:${server.port}/resolve`,{method:'POST',headers:{Origin:'http://127.0.0.1:5173','Content-Type':'application/json'},body:JSON.stringify({source,stream:true})});
 const pending=readDecisionResponse(response,new AbortController().signal,async p=>{progress.push(p);});
 await expect.poll(()=>progress.at(-1)?.completed).toBe(16);expect(progress[0].total).toBe(35);expect(progress[1].resolutions).toHaveLength(16);next();const result=await pending;expect(result.decisions.resolutions).toHaveLength(16);expect(result.decisions.fallbackCodes).toContain('provider-failed');
 }finally{next();await server.close();}
});
test('session displays partial braille before final reply and preserves it on network failure',async()=>{
 let release!:()=>void;const gate=new Promise<void>(r=>release=r);const source='重量';const target=collectAmbiguities(source)[0];
 const s=new EditorSession(executeSemanticJob,async(job,signal,progress)=>{await progress?.({completed:1,total:2,reviewedIds:[target.id],resolutions:[{id:target.id,choice:'chong2',source:'api',confidence:.7}]});await gate;throw Error('disconnected');});
 await s.setSource(source);const before=s.result!.unicode;const pending=s.resolveOnline();await expect.poll(()=>s.decisionProgress?.completed).toBe(1);await expect.poll(()=>s.result!.unicode!==before).toBe(true);expect(s.onlineBusy).toBe(true);release();await pending;expect(s.result!.unicode).not.toBe(before);expect(s.history[0].status).toBe('failed');
});
test('rules avoid model calls for clear clocks, ratios and checked words',async()=>{let called=0;const progress:any[]=[];const r=await resolveAmbiguities('银行发通知：会议12:30开始，比例3:2',{processAll:true,onProgress:p=>progress.push(p),provider:async qs=>{called+=qs.length;return {resolutions:[],diagnostics:[]};}});expect(r.resolutions.some(r=>r.choice==='time')).toBe(true);expect(r.resolutions.some(r=>r.choice==='ratio')).toBe(true);expect(progress[0].localResolved).toBeGreaterThan(0);expect(called).toBeLessThan(r.ambiguities.length);});
test('truncated or nonmonotonic streams fail rather than fabricate completion',async()=>{const signal=new AbortController().signal;const p={type:'progress',completed:1,total:2,resolutions:[],reviewedIds:[]};for(const text of [JSON.stringify(p)+'\n',JSON.stringify(p)+'\n'+JSON.stringify({...p,completed:0})+'\n'])await expect(readDecisionResponse(new Response(text,{headers:{'Content-Type':'application/x-ndjson'}}),signal)).rejects.toThrow();});
