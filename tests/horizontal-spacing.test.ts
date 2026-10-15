import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {applyManualBraille} from '../packages/core/src/manual-braille';
import {encodeText} from '../packages/core/src/rules/text';
const options={mode:'math' as const,paragraphIndent:0};
test.each(['em','ex','mu','pt','bp','pc','mm','cm','in','dd','cc','nd','nc','sp'])('spacing retains literal %s rather than making it an operand',unit=>{
 const source=`a\\hspace{2${unit}}b`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='math-spacing-described')).toBe(true);
 const distance=r.atoms.filter(a=>a.ruleId==='editorial-spacing-distance');
 expect(distance.map(a=>a.kind==='cell'?a.cells:'').join('')).toBe(encodeText(`2${unit}`,0,{mathText:true}).atoms.map(a=>a.cells).join(''));
 expect(distance.every(a=>source.slice(a.span.start,a.span.end)===`2` ||source.slice(a.span.start,a.span.end)===unit)).toBe(true);
 expect(r.metadata.chineseWords.some(w=>w.raw===unit)).toBe(false);
 expect(convert(source,{paragraphIndent:0}).complete).toBe(true);
});
test.each(['-.5em','+2.0cm','0pt','2.pt',' 1 em '])('signed/fractional/zero distances retain original spelling: %s',value=>{
 const source=`x\\hspace{${value}}y`,r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 const cells=r.atoms.filter(a=>a.kind==='cell'&&a.ruleId==='editorial-spacing-distance').map(a=>a.kind==='cell'?a.cells:'').join('');
 expect(cells).toBe(encodeText(value,0,{mathText:true}).atoms.map(a=>a.cells).join(''));
});
test('unbraced distances stop before subsequent mathematical content',()=>{
 const r=convert(String.raw`a\hspace1emx+1`,options),braced=convert(String.raw`a\hspace{1em}x+1`,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(braced.unicode);
 expect(r.atoms.some(a=>r.document.source.slice(a.span.start,a.span.end)==='x')).toBe(true);
});
test('starred and ordinary horizontal space remain distinguishable',()=>{
 const a=convert(String.raw`x\hspace{2em}y`,options),b=convert(String.raw`x\hspace*{2em}y`,options);
 expect(a.complete&&b.complete).toBe(true);expect(a.unicode).not.toBe(b.unicode);
 expect(b.document.source).toBe(String.raw`x\hspace*{2em}y`);
});
test.each([String.raw`\frac{x\hspace{1em}y}{z}`,String.raw`x^{a\hspace{1em}b}`,String.raw`\begin{aligned}\text{因为}&x\hspace{1em}y=1\\\text{所以}&z=2\end{aligned}`])('spacing remains within the original formula field: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
 for(const w of r.metadata.chineseWords)expect(source.slice(w.span.start,w.span.end)).toBe(w.raw);
});
test.each([String.raw`a\hspace{}b`,String.raw`a\hspace{bad}b`,String.raw`a\hspace{2px}b`,String.raw`a\hspace{\unknown}b`,String.raw`a\hspace`,String.raw`a\hspace{2em`])('unsupported or malformed lengths remain visible: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toContain('⠿');
 expect(r.diagnostics.some(d=>d.code==='math-invalid-horizontal-space')).toBe(true);
});
test('spacing captions survive word edits and narrow-layout preview',()=>{
 const source=String.raw`\text{因为}\hspace*{2em}x`,r=encodeDocument(source,options),start=source.indexOf('因为'),edited=applyManualBraille(r,[{start,end:start+2,cells:'⠁⠃'}]);
 const caption=(v:typeof r)=>v.atoms.filter(a=>a.ruleId?.startsWith('editorial-spacing-'));
 expect(caption(edited)).toEqual(caption(r));
 const narrow=convert(source,{...options,columns:4}),wide=convert(source,{...options,columns:100});
 expect(narrow.atoms).toEqual(wide.atoms);expect(narrow.unicode||narrow.preview?.unicode).toBeTruthy();expect(narrow.document.source).toBe(source);
});
