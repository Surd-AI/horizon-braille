import type {SourceSpan} from '../model';
export interface TexColumnDefinition {type:'l'|'c'|'r'|'p'|'m'|'b';raw:string;span:SourceSpan;width?:{raw:string;span:SourceSpan}}
export interface TexColumnRule {beforeColumn:number;count:number;raw:string;span:SourceSpan}
export const isLiteralTexDimension=(value:string)=>/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)\s*(?:pt|pc|in|bp|cm|mm|dd|cc|sp|em|ex)$/.test(value.trim());
/** Finite source-bound column grammar; never expands executable TeX declarations. */
export function parseTexColumns(raw:string,start:number) {
 const unresolved:{raw:string;span:SourceSpan;reason:string}[]=[];
 let known=true,expanded=false;
 const maximum=512;
 type Fragment={definitions:TexColumnDefinition[];rules:TexColumnRule[]};
 const parse=(value:string,base:number,depth:number):Fragment=>{
  const definitions:TexColumnDefinition[]=[],rules:TexColumnRule[]=[];
  let i=0;
  const fail=(from:number,end:number,reason:string)=>{known=false;unresolved.push({raw:value.slice(from,end),span:{start:base+from,end:base+end},reason});};
  const group=():{raw:string;start:number;end:number}|undefined=>{
   while(/\s/.test(value[i]??'')&&i<value.length)i++;
   if(value[i]!=='{')return;
   const from=++i;let nesting=1;
   while(i<value.length&&nesting){if(value[i]==='\\'){i+=Math.min(2,value.length-i);continue;}if(value[i]==='{')nesting++;if(value[i]==='}')nesting--;i++;}
   if(nesting)return;
   return {raw:value.slice(from,i-1),start:base+from,end:base+i-1};
  };
  const append=(fragment:Fragment)=>{
   if(definitions.length+fragment.definitions.length>maximum){fail(0,value.length,'expanded column limit');return false;}
   const offset=definitions.length;definitions.push(...fragment.definitions);
   rules.push(...fragment.rules.map(r=>({...r,beforeColumn:r.beforeColumn+offset})));return true;
  };
  if(depth>32){fail(0,value.length,'column nesting limit');return {definitions,rules};}
  while(i<value.length) {
   const from=i,type=value[i];if(/\s/.test(type)){i++;continue;}
   if(/[lcrpmb]/.test(type)) {
    i++;const width=/[pmb]/.test(type)?group():undefined;
    if(/[pmb]/.test(type)&&!width){fail(from,i,'missing paragraph width');break;}
    if(definitions.length>=maximum){fail(from,value.length,'expanded column limit');break;}
    definitions.push({type:type as TexColumnDefinition['type'],raw:value.slice(from,i),span:{start:base+from,end:base+i},...(width?{width:{raw:width.raw,span:{start:width.start,end:width.end}}}:{})});
    if(width&&!isLiteralTexDimension(width.raw))unresolved.push({raw:width.raw,span:{start:width.start,end:width.end},reason:'unevaluated paragraph width'});
    continue;
   }
   if(type==='|') {
    while(value[i]==='|')i++;
    rules.push({beforeColumn:definitions.length,count:i-from,raw:value.slice(from,i),span:{start:base+from,end:base+i}});continue;
   }
   if(type==='*') {
    i++;const count=group(),pattern=group();
    const times=count&&/^\d+$/.test(count.raw.trim())?Number(count.raw.trim()):NaN;
    if(!count||!pattern||!Number.isSafeInteger(times)||times>maximum){fail(from,i,'invalid or excessive repeat count');break;}
    expanded=true;
    if(times) {
     const fragment=parse(pattern.raw,pattern.start,depth+1);
     if(fragment.definitions.length*times+definitions.length>maximum || fragment.rules.length*times>maximum*4){fail(from,i,'expanded column limit');break;}
     for(let repeat=0;repeat<times;repeat++)if(!append(fragment))break;
    }
    continue;
   }
   fail(from,value.length,'unknown column declaration');break;
  }
  return {definitions,rules};
 };
 const result=parse(raw,start,0);
 const merged:TexColumnRule[]=[];
 for(const rule of result.rules) {
  const previous=merged.at(-1);
  if(previous?.beforeColumn===rule.beforeColumn) {
   previous.count+=rule.count;previous.span={start:Math.min(previous.span.start,rule.span.start),end:Math.max(previous.span.end,rule.span.end)};
   previous.raw=raw.slice(previous.span.start-start,previous.span.end-start);
  } else merged.push({...rule});
 }
 result.rules=merged;
 if(!result.definitions.length)known=false;
 return {...result,known,expanded,unresolved};
}
