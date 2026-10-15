import {test,expect} from 'vitest';
import {convert} from '../packages/core/src/convert';
const options={mode:'math' as const,paragraphIndent:0};
const pairs=[['leqq','≦'],['geqq','≧'],['lesssim','≲'],['gtrsim','≳'],['lessapprox','⪅'],['gtrapprox','⪆'],['subsetneq','⊊'],['supsetneq','⊋'],['subsetneqq','⫋'],['supsetneqq','⫌'],['subseteqq','⫅'],['supseteqq','⫆'],['doteq','≐'],['Doteq','≑'],['doteqdot','≑']];
test.each(pairs)('%s retains the same relation glyph as %s',(name,glyph)=>{
 const source=`A\\${name} B`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(convert(`A${glyph}B`,options).unicode);
 expect(r.document.source).toBe(source);expect(r.metadata.chineseWords).toEqual([]);
 expect(r.atoms.every(a=>a.span.start>=0 && a.span.end<=source.length)).toBe(true);
 expect(convert(source,{paragraphIndent:0}).complete).toBe(true);
 expect(convert(source,{...options,symbolPolicy:'review-unmapped'}).complete).toBe(false);
});
test('line count, relation direction, strictness and dot positions stay distinct',()=>{
 const names=pairs.map(p=>p[0]).filter(n=>n!=='doteqdot');
 const outputs=names.map(n=>convert(`A\\${n} B`,options).unicode);
 expect(new Set(outputs).size).toBe(names.length);
 for(const n of ['leq','geq','subset','supset','subseteq','supseteq','approx','=','sim'])
  expect(outputs).not.toContain(convert(`A${n==='='?'=':'\\'+n} B`,options).unicode);
});
test.each([String.raw`\frac{a\lesssim b}{c\geqq d}`,String.raw`x^{a\doteq b}`,String.raw`\begin{aligned}\text{因为}&A\subsetneq B\\\text{所以}&B\supsetneqq A\end{aligned}`])('relations retain compound fields and Chinese text: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.unicode||r.preview?.unicode).toBeTruthy();
 for(const word of r.metadata.chineseWords)expect(source.slice(word.span.start,word.span.end)).toBe(word.raw);
});
test('unknown operands remain visible rather than falsely completing the relation',()=>{
 const source=String.raw`a\lesssim\unknown{b}+c`,r=convert(source,options);
 expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toContain('⠿');
 expect(r.atoms.some(a=>a.ruleId==='unhandled-source-transcription')).toBe(true);
 for(const value of ['a','b','c'])expect(r.atoms.some(a=>source.slice(a.span.start,a.span.end)===value)).toBe(true);
});
