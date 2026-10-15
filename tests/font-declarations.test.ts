import {test,expect} from 'vitest';
import {convert} from '../packages/core/src/convert';
import {parseMath,type MathSemanticNode as N} from '../packages/core/src/parser/math';
const options={mode:'math' as const,paragraphIndent:0};
const aliases={rm:'mathrm',bf:'mathbf',it:'mathit',sf:'mathsf',tt:'mathtt',cal:'mathcal'};
const styles=(n:N):N[]=>[...(n.kind==='style'?[n]:[]),...(n.kind==='sequence'?n.children:n.kind==='style'||n.kind==='group'?[n.body]:[]).flatMap(styles)];
test.each(Object.entries(aliases))('%s applies to the entire group like %s', (name,font)=>{
 const source=`{\\${name} A+B}c`,r=convert(source,options),style=styles(parseMath(source).body)[0];
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.unicode).toBe(convert(`{\\${font}{A+B}}c`,options).unicode);
 expect(style.kind).toBe('style');if(style.kind==='style'){expect(style.name).toBe(font);expect(style.body.raw.trim()).toBe('A+B');}
 expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
});
test('a group immediately following a declaration does not end the declaration',()=>{
 const source=String.raw`\bf{A}B+C`,style=styles(parseMath(source).body)[0];
 if(style.kind==='style')expect(style.body.raw).toBe('{A}B+C');
 expect(convert(source,options).unicode).toBe(convert(String.raw`\mathbf{{A}B+C}`,options).unicode);
});
test('later declarations override inner scope and outer braces restore fonts',()=>{
 const source=String.raw`{\bf A{\it B}C\rm D}e`;
 expect(styles(parseMath(source).body).map(n=>n.kind==='style'?n.name:'')).toEqual(['mathbf','mathit','mathrm']);
 expect(convert(source,options).unicode).toBe(convert(String.raw`{\mathbf{A{\mathit{B}}C\mathrm{D}}}e`,options).unicode);
});
test.each([String.raw`\left(\bf A+B\right)c`,String.raw`\left(\bf A+\left[B\right]\right)c`])('matching right delimiter closes font scope: %s',source=>{
 const style=styles(parseMath(source).body)[0];expect(style.kind).toBe('style');
 if(style.kind==='style')expect(style.body.raw).not.toContain('c');
 expect(convert(source,options).complete).toBe(true);
});
test.each([String.raw`\bf`,String.raw`{\it}`,String.raw`\bf\unknown`,String.raw`\sqrt\bf x`])('invalid or unsupported declaration retains output: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
test.each(['sf','tt'])('unmapped %s font is described or kept for review',name=>{
 const source=`\\${name} A+B`;
 expect(convert(source,options).diagnostics.some(d=>d.code==='math-font-described')).toBe(true);
 const r=convert(source,{...options,fontPolicy:'review-unmapped'});expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
test('bare OCR declarations are recognized in document mode',()=>{
 const r=convert(String.raw`\bf A+B`,{mode:'document',paragraphIndent:0});expect(r.complete).toBe(true);
 expect(r.diagnostics.some(d=>d.code==='document-source-transcribed')).toBe(false);
});
test('aligned Chinese and declaration bodies retain source word offsets',()=>{
 const source=String.raw`\begin{aligned}{\bf\text{因为}A}&=B\\{\it\text{所以}C}&=D\end{aligned}`,r=convert(source,options);
 expect(r.complete).toBe(true);for(const w of r.metadata.chineseWords)expect(source.slice(w.span.start,w.span.end)).toBe(w.raw);
});
