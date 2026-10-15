import type {Document} from '../model';
export type EmphasisMarker={end:number;role:'emphasis-start'|'emphasis-end'|'strong-start'|'strong-end'};
/** Source-bound delimiter pairing; CommonMark flanking and rule-of-three.
 * Opaque math/code and structural blocks come from the first document scan.
 */
export function emphasisMarkers(source:string,probe:Document):{markers:Map<number,EmphasisMarker>;limited:boolean} {
 const markers=new Map<number,EmphasisMarker>(),protectedUnits=new Uint8Array(source.length),barriers:number[]=[];
 for(const n of probe.nodes){
  if(['inline-math','display-math','chemistry','code-block','code-span','markdown-marker','escaped-text'].includes(n.kind))protectedUnits.fill(1,n.span.start,n.span.end);
  if(n.kind==='paragraph-break'||n.kind==='code-block'||n.kind==='markdown-marker'&&n.role!=='blockquote')barriers.push(n.span.start);
  if(n.kind==='bare-math'||n.kind==='unparsed'){
   let depth=0;for(let at=n.span.start;at<n.span.end;at++){
    const c=source[at];if(c==='\\'){if(depth){protectedUnits[at]=1;if(at+1<n.span.end)protectedUnits[at+1]=1;}at++;continue;}
    if(c==='{')depth++;if(depth)protectedUnits[at]=1;if(c==='}'&&depth)depth--;
   }
  }
 }
 // Link destinations and tag attributes are source syntax, not emphasis text.
 // Protect them without resolving URLs, executing HTML, or claiming link support.
 let contextWork=0;
 for(let at=0;at<source.length;at++){
  if(protectedUnits[at])continue;
  if(source[at]===']'&&source[at+1]==='('){
   const start=at+1;let end=start+1,depth=1;
   for(;end<source.length&&depth;end++){
    if(++contextWork>source.length*4)return {markers,limited:true};
    if(source[end]==='\\'){end++;continue;}if(source[end]==='(')depth++;else if(source[end]===')')depth--;
    if(source[end]==='\n'&&source[end+1]==='\n')break;
   }
   if(!depth){protectedUnits.fill(1,start,end);at=end-1;}
  } else if(source[at]==='<'&&/^<\/?[A-Za-z][A-Za-z0-9-]*(?=[\s/>])/.test(source.slice(at,at+256))){
   let end=at+1,quote='';for(;end<source.length;end++){
    if(++contextWork>source.length*4)return {markers,limited:true};
    const c=source[end];if(quote){if(c===quote)quote='';}else if(c==='"'||c==="'")quote=c;else if(c==='>')break;
   }
   if(end<source.length){protectedUnits.fill(1,at,end+1);at=end;}
  }
 }
 type Run={start:number;end:number;length:number;remaining:number;left:number;right:number;marker:string;open:boolean;close:boolean};
 const stack:Run[]=[],bottom=new Map<string,number>();let barrier=0,steps=0;
 const whitespace=(c:string)=>!c||/[\p{Zs}\t\r\n\f]/u.test(c),punctuation=(c:string)=>!!c&&/[\p{P}\p{S}]/u.test(c);
 const before=(at:number)=>{if(!at)return '';let index=at-1;if(source.charCodeAt(index)>=0xDC00&&source.charCodeAt(index)<=0xDFFF&&index&&source.charCodeAt(index-1)>=0xD800&&source.charCodeAt(index-1)<=0xDBFF)index--;return String.fromCodePoint(source.codePointAt(index)!);};
 for(const match of source.matchAll(/\*+|_+/g)){
  let start=match.index,length=match[0].length;
  while(barrier<barriers.length&&barriers[barrier]<=start){stack.length=0;bottom.clear();barrier++;}
  while(length&&protectedUnits[start]){start++;length--;}if(!length)continue;
  let slash=start;while(slash>0&&source[slash-1]==='\\')slash--;
  if((start-slash)%2){start++;length--;if(!length)continue;}
  const end=start+length,prev=before(start),next=end<source.length?String.fromCodePoint(source.codePointAt(end)!):'';
  const left=!whitespace(next)&&(!punctuation(next)||whitespace(prev)||punctuation(prev));
  const right=!whitespace(prev)&&(!punctuation(prev)||whitespace(next)||punctuation(next));
  const marker=source[start],run:Run={start,end,length,remaining:length,left:0,right:0,marker,open:marker==='_'?left&&(!right||punctuation(prev)):left,close:marker==='_'?right&&(!left||punctuation(next)):right};
  if(run.close)while(run.remaining){
   const key=`${marker}:${run.open?1:0}:${length%3}`,floor=bottom.get(key)??-1;let found=-1;
   for(let index=stack.length-1;index>=0&&stack[index].start>floor;index--){
    if(++steps>source.length*8)return {markers,limited:true};
    const opener=stack[index];if(opener.marker!==marker)continue;
    if((opener.close||run.open)&&(opener.length+length)%3===0&&(opener.length%3!==0||length%3!==0))continue;
    found=index;break;
   }
   if(found<0){bottom.set(key,start-1);break;}
   const opener=stack[found],count=opener.remaining>=2&&run.remaining>=2?2:1;
   const a=opener.end-opener.right-count,b=run.start+run.left;
   markers.set(a,{end:a+count,role:count===2?'strong-start':'emphasis-start'});markers.set(b,{end:b+count,role:count===2?'strong-end':'emphasis-end'});
   opener.right+=count;opener.remaining-=count;run.left+=count;run.remaining-=count;stack.length=found+1;if(!opener.remaining)stack.pop();
  }
  if(run.open&&run.remaining)stack.push(run);
 }
 return {markers,limited:false};
}
