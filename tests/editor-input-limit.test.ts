import { expect, test, vi } from 'vitest';
import { EditorSession } from '../apps/playground/src/session';
import { encodeDocument } from '../packages/core/src/convert';
import { startLocalServer } from '../apps/api/src/server';

test('oversized paste is preserved but never dispatched; older replies cannot revive it',async()=>{
 let finish:any;
 const execute=vi.fn((job:any)=>new Promise<any>(r=>{finish=()=>r({encoded:encodeDocument(job.source),decisions:{documentSource:job.source,resolutions:[]},ambiguities:[]});}));
 const cancel=vi.fn(),s=new EditorSession(execute,undefined,cancel);
 const old=s.setSource('旧');const large='文'.repeat(5001);
 await s.setSource(large);expect(s.source).toBe(large);expect(s.busy).toBe(false);
 expect(s.error).toContain('5000');expect(execute).toHaveBeenCalledTimes(1);
 finish();await old;expect(s.result).toBeUndefined();expect(s.source).toBe(large);
});
test('limit counts Unicode code points, including exact-boundary astral input',async()=>{
 const execute=vi.fn(async(job:any)=>({encoded:encodeDocument(''),decisions:{documentSource:job.source,resolutions:[]},ambiguities:[]}));
 const s=new EditorSession(execute);
 await s.setSource('😀'.repeat(5000));expect(execute).toHaveBeenCalledTimes(1);
 await s.setSource('😀'.repeat(5001));expect(execute).toHaveBeenCalledTimes(1);expect(s.error).toContain('5000');
});
test.each(['/convert','/resolve','/segment'])('API %s rejects oversized source before model work',async(path)=>{
 const provider=vi.fn(async()=>({resolutions:[],diagnostics:[]})), segmenter=vi.fn(async()=>({tokens:[],model:'test'}));
 const server=await startLocalServer({port:0,configured:false,origins:['http://127.0.0.1:5185'],provider,segmenter:segmenter as any});
 try {
  const response=await fetch(`http://127.0.0.1:${server.port}${path}`,{method:'POST',headers:{Origin:'http://127.0.0.1:5185','Content-Type':'application/json'},body:JSON.stringify({source:'中'.repeat(5001)})});
  expect(response.status).toBe(413);expect(await response.json()).toMatchObject({error:'source-too-long',maxCharacters:5000});
  expect(provider).not.toHaveBeenCalled();expect(segmenter).not.toHaveBeenCalled();
 } finally {await server.close();}
});
