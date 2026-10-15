import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={mode:'math' as const,columns:30,paragraphIndent:0};
test.each(['^2','_3','²','₃',String.raw`{}^{a+b}`,String.raw`_{6}^{12}C`,String.raw`{_6}^{12}C`,String.raw`\frac{^{a+b}}{x}`,String.raw`\begin{aligned}^2&x\\_3&y\end{aligned}`])('empty-nucleus %s retains parsed fields and original source',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);expect(r.diagnostics.some(d=>d.code==='math-empty-script-described')).toBe(true);
 expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
 expect(convert(`$${source}$`,{...options,mode:'document'}).complete).toBe(true);
});
test('implicit and explicitly empty bases agree while positions remain distinct',()=>{
 expect(convert('^2',options).unicode).toBe(convert('{}^2',options).unicode);expect(convert('_3',options).unicode).toBe(convert('{}_{3}',options).unicode);
 expect(convert('^2',options).unicode).not.toBe(convert('_2',options).unicode);expect(convert('^2x',options).unicode).not.toBe(convert('x^2',options).unicode);
 expect(convert('^2',{...options,symbolPolicy:'review-unmapped'}).complete).toBe(false);
});
test.each(['^','_','^{}','_{}','^2^3',String.raw`^{\unknown}`])('invalid or unresolved script %s still retains output',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
test('manual Chinese payload edits retain the empty-base caption',()=>{
 const source=String.raw`^{\text{因为}}`,r=encodeDocument(source,options),start=source.indexOf('因为');expect(r.complete).toBe(true);
 const edited=applyManualBraille(r,[{start,end:start+2,cells:'⠁⠃'}]);expect(edited.atoms.filter(a=>a.ruleId==='editorial-empty-script-description')).toEqual(r.atoms.filter(a=>a.ruleId==='editorial-empty-script-description'));
});
test.each(['^*','_*','{}^*','{}_{*}'])('star in empty-base index %s remains a position mark',source=>{
 expect(convert(source,options).complete).toBe(true);expect(convert(source,options).diagnostics.some(d=>d.code==='math-star-role-unverified')).toBe(false);
 expect(convert(source+'+*',options).diagnostics.some(d=>d.code==='math-star-role-unverified')).toBe(true);
});
