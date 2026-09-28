import {test,expect} from 'vitest';
import {resolveAmbiguities,collectAmbiguities,convertWithResolutions} from '../packages/core/src/ambiguity';
test('model-first covers checked grammar and symbols in batches, keeps manual and applies 0.5',async()=>{
 const source='银行：会议12:30，比例3:2。'+ '行。'.repeat(140);const questions=collectAmbiguities(source);const manual=questions[0];const sizes:number[]=[];
 const r=await resolveAmbiguities(source,{modelFirst:true,processAll:true,manual:{documentSource:source,resolutions:[{id:manual.id,choice:manual.candidates[0].id,source:'manual'}]},provider:async qs=>{sizes.push(qs.length);return {resolutions:qs.map(q=>({id:q.id,choice:q.candidates.find(c=>c.id!=='unknown')!.id,source:'api',confidence:0.5})),diagnostics:[],trace:{requestSent:true,outcome:'complete'}};}});
 expect(sizes.length).toBeGreaterThan(2);expect(Math.max(...sizes)).toBeLessThanOrEqual(64);expect(sizes.reduce((a,b)=>a+b,0)).toBe(questions.length-1);
 expect(r.resolutions).toHaveLength(questions.length);expect(r.resolutions.find(x=>x.id===manual.id)?.source).toBe('manual');
 expect(r.resolutions.filter(x=>x.source==='api')).toHaveLength(questions.length-1);expect(r.audit!.questions.length).toBeLessThanOrEqual(128);
 expect(r.diagnostics.some(d=>d.code==='ambiguity-budget')).toBe(false);
 const encoded=convertWithResolutions(source,r);expect(encoded.diagnostics.some(d=>d.code==='ambiguity-pending')).toBe(false);
});
test('cancel stops subsequent batches and does not adopt incomplete request',async()=>{
 const abort=new AbortController();let calls=0;const r=await resolveAmbiguities('行。'.repeat(130),{processAll:true,signal:abort.signal,provider:async qs=>{calls++;abort.abort();return {resolutions:qs.map(q=>({id:q.id,choice:'xing2',source:'api',confidence:1})),diagnostics:[]};}});expect(calls).toBe(1);expect(r.resolutions).toEqual([]);
});
