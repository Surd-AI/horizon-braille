import {test,expect} from 'vitest';
import {EditorSession,executeSemanticJob} from '../apps/playground/src/session';
test('failed worker retains partial formula output through local conversion',async()=>{
 const session=new EditorSession(async()=>{throw new Error('Worker unavailable');});
 session.options.mode='math';const source=String.raw`\frac{a+\unknown{x}}{b}`;
 await session.setSource(source);
 expect(session.result?.document.source).toBe(source);expect(session.result?.complete).toBe(false);
 expect(session.result?.unicode||session.result?.preview?.unicode).toBeTruthy();
 expect(session.result?.atoms.some(a=>a.ruleId==='unhandled-source-transcription')).toBe(true);
 expect(session.result?.diagnostics.some(d=>d.code==='editor-local-fallback')).toBe(true);
 expect(session.error).toContain('本地生成结果');expect(session.busy).toBe(false);
});
test('late failure cannot replace a newer successful source',async()=>{
 let rejectOld!:(e:Error)=>void;
 const session=new EditorSession(job=>job.source==='old'?new Promise((_,reject)=>{rejectOld=reject;}):executeSemanticJob(job));
 const old=session.setSource('old');await session.setSource('x=2');rejectOld(new Error('old failed'));await old;
 expect(session.result?.document.source).toBe('x=2');expect(session.error).toBe('');
});
test('local fallback can retain a valid complete formula without pretending it failed',async()=>{
 const session=new EditorSession(async()=>{throw new Error('Worker unavailable');});
 session.options.mode='math';await session.setSource(String.raw`\frac{1}{2}`);
 expect(session.result?.complete).toBe(true);expect(session.result?.unicode).toBeTruthy();
 expect(session.result?.diagnostics.some(d=>d.code==='editor-local-fallback')).toBe(true);
});
test('an actual local encoder failure still exposes a labelled literal source transcription',async()=>{
 const session=new EditorSession(async()=>{throw new Error('Worker unavailable');});
 session.options.mode='math';session.options.analyze=()=>{throw new Error('Broken custom analyzer');};
 const source=String.raw`\text{abc}+x`;await session.setSource(source);
 expect(session.result?.document.source).toBe(source);expect(session.result?.complete).toBe(false);
 expect(session.result?.unicode||session.result?.preview?.unicode).toBeTruthy();
 expect(session.result?.diagnostics.some(d=>d.code==='editor-source-transcription-fallback')).toBe(true);
 expect(session.error).toContain('文字转写');expect(session.busy).toBe(false);
});
