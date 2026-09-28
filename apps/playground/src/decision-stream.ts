import type {DecisionProgress} from '../../../packages/core/src/ambiguity';
/** Bounded NDJSON reader; supports legacy JSON responses during rolling upgrades. */
export async function readDecisionResponse(response: Response, signal: AbortSignal, onProgress?: (p: DecisionProgress)=>Promise<void>) {
  if(!response.ok || !response.body) throw new Error('在线消歧服务 HTTP '+response.status);
  if(Number(response.headers.get('content-length'))>16*1024*1024)throw new Error('消歧响应过大');
  const stream=response.headers.get('content-type')?.includes('application/x-ndjson');
  const reader=response.body.getReader(), decoder=new TextDecoder('utf-8',{fatal:true});
  let buffer='',bytes=0,completed=0,total:number|undefined, result:any;
  const stop=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',stop,{once:true});
  const line=async(text:string)=>{
    if(!text.trim())return; const event=JSON.parse(text);
    if(event.type==='error')throw new Error('服务器判断中断，已完成结果已保留');
    if(event.type==='result'){if(result!==undefined)throw new Error('重复结果');result=event.data;return;}
    if(event.type!=='progress' || result!==undefined || !Number.isInteger(event.total) || event.total<0 || event.total>10000 || !Number.isInteger(event.completed) || event.completed<completed || event.completed>event.total || (total!==undefined && total!==event.total) || !Array.isArray(event.resolutions) || event.resolutions.length>64 || !Array.isArray(event.reviewedIds) || event.reviewedIds.length>64 || event.reviewedIds.some((id:unknown)=>typeof id!=='string'))throw new Error('无效判断进度');
    total=event.total;completed=event.completed;
    if(!signal.aborted)await onProgress?.({total:event.total,completed,localResolved:Number.isInteger(event.localResolved)&&event.localResolved>=0&&event.localResolved<=10000?event.localResolved:0,resolutions:event.resolutions,reviewedIds:event.reviewedIds});
  };
  try {
    if(signal.aborted)throw new Error('已取消');
    while(true){const part=await reader.read();if(signal.aborted)throw new Error('已取消');if(part.done)break;bytes+=part.value.byteLength;if(bytes>16*1024*1024)throw new Error('消歧响应过大');buffer+=decoder.decode(part.value,{stream:true});if(stream){let i;while((i=buffer.indexOf('\n'))>=0){const text=buffer.slice(0,i);buffer=buffer.slice(i+1);await line(text);}}}
    buffer+=decoder.decode();if(stream){await line(buffer);if(result===undefined)throw new Error('连接中断，已完成判断已保留');return result;}
    return JSON.parse(buffer);
  } finally {signal.removeEventListener('abort',stop);stop();}
}
