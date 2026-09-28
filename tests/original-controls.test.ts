import { it, expect } from 'vitest';
import { convert } from '../packages/core/src/convert';
import { normalizeManualReading } from '../packages/core/src/language/reading-validation';
import { normalizeSyllable } from '../packages/core/src/rules/chinese';
it.each(['fiong2','küe3','notpinyin4','xi1 an1','xian','ma6','ma-1'])('rejects unsupported manual syllable %s', reading => {
 expect(normalizeManualReading(reading)).toBeNull();
 const result=convert('马',{overrides:[{start:0,end:1,readings:[reading]}]});
 expect(result.complete).toBe(false); expect(result.diagnostics.some(d=>d.code==='CHINESE_INVALID_OVERRIDE')).toBe(true);
});
it('distinguishes encodable combinations from valid supported syllables',()=>{
 expect(normalizeSyllable('fiong2')).not.toBeNull(); expect(normalizeManualReading('fiong2')).toBeNull();
});
it.each(['NÜ3','nv3','nu:3','er0','er5','XIAN1','jü3'])('accepts supported aliases %s',reading=>expect(normalizeManualReading(reading)).not.toBeNull());
it('rejects syllable count mismatch without accepting a complete conversion',()=>expect(convert('西安',{overrides:[{start:0,end:2,readings:['xian1']}]}).complete).toBe(false));
it.each([true,false])('math/chemistry recognition are independent with math=%s', recognizeMath=>{
 const source=String.raw`前\frac{1}{2}后\ce{H2O}尾`;
 const r=convert(source,{recognizeMath,recognizeChemistry:false});
 expect(r.document.nodes.map(n=>n.raw).join('')).toBe(source);
 expect(r.document.nodes.some(n=>n.kind==='bare-math')).toBe(recognizeMath);
 expect(r.document.nodes.some(n=>n.kind==='chemistry')).toBe(false);
 expect(r.diagnostics.some(d=>d.code==='domain-disabled-literal')).toBe(true);
 const chemical=convert(source,{recognizeMath:false,recognizeChemistry:true});
 expect(chemical.document.nodes.some(n=>n.kind==='chemistry')).toBe(true);
 expect(chemical.document.nodes.some(n=>n.kind==='bare-math')).toBe(false);
});
it('chemical wrappers work when math is disabled; nested disabled chemistry falls back explicitly',()=>{
 const source=String.raw`前$\ce{H2O}$后`;
 const on=convert(source,{recognizeMath:false,recognizeChemistry:true});
 expect(on.document.nodes[1].kind).toBe('chemistry');expect(on.document.nodes.map(n=>n.raw).join('')).toBe(source);
 const nested=String.raw`前$x+\ce{H2O}$后`;
 const off=convert(nested,{recognizeMath:true,recognizeChemistry:false});
 expect(off.document.nodes[1].kind).toBe('text');expect(off.document.nodes.map(n=>n.raw).join('')).toBe(nested);
 expect(off.diagnostics.some(d=>d.code==='domain-disabled-literal')).toBe(true);
});
it('explicit full tones actually differ from normative one-tone omission',()=>{
 const opts={overrides:[{start:0,end:1,readings:['fa1']}]};
 expect(convert('发',{...opts,chinese:{tones:'full'}}).unicode).not.toBe(convert('发',{...opts,chinese:{tones:'normative'}}).unicode);
});
