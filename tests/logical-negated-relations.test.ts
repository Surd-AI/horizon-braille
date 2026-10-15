import {expect,test} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={mode:'math' as const,paragraphIndent:0,columns:30};
const relations=[['models','⊨'],['vDash','⊨'],['Vdash','⊩'],['Vvdash','⊪'],['nvdash','⊬'],['nvDash','⊭'],['nVdash','⊮'],['nVDash','⊯'],['nleq','≰'],['ngeq','≱'],['nmid','∤'],['nparallel','∦']];
test.each(relations)('%s preserves the sign, original spans and Unicode equivalence',(name,glyph)=>{
 const source=`a\\${name} b`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.unicode).toBe(convert(`a${glyph}b`,options).unicode);
 expect(r.diagnostics.some(d=>d.code==='math-symbol-described')).toBe(true);
 expect(r.metadata.chineseWords).toEqual([]);
 expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
 expect(convert(source,{...options,symbolPolicy:'review-unmapped'}).complete).toBe(false);
 for(const input of [source,`a${glyph}b`]) {
  const doc=convert(input,{...options,mode:'document'});
  expect(doc.complete).toBe(true);expect(doc.unicode).toBe(r.unicode);
 }
});
test('line counts, orientations and negations remain distinct',()=>{
 const names=['vdash','vDash','Vdash','Vvdash','nvdash','nvDash','nVdash','nVDash','nleq','ngeq','nmid','nparallel'];
 expect(new Set(names.map(name=>convert(`a\\${name} b`,options).unicode)).size).toBe(names.length);
 expect(convert(String.raw`a\models b`,options).unicode).toBe(convert(String.raw`a\vDash b`,options).unicode);
});
test.each([String.raw`\frac{a\nvDash b}{c\nleq d}`,String.raw`x^{a\nmid b}`,String.raw`\begin{aligned}\text{因为}&a\Vdash b\\\text{所以}&c\nparallel d\end{aligned}`])('compound scopes retain fields: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 for(const w of r.metadata.chineseWords)expect(source.slice(w.span.start,w.span.end)).toBe(w.raw);
});
test('editable Chinese words leave sign descriptions untouched',()=>{
 const source=String.raw`\text{因为}a\nVDash b`,r=encodeDocument(source,options),start=source.indexOf('因为');
 const edited=applyManualBraille(r,[{start,end:start+2,cells:'⠁⠃'}]);
 expect(edited.atoms.filter(a=>a.ruleId==='editorial-symbol-description')).toEqual(r.atoms.filter(a=>a.ruleId==='editorial-symbol-description'));
});
test('unknown names and arguments next to described relations still have output',()=>{
 const source=String.raw`a\nleq\unrecognized{x}+b`,r=convert(source,options);
 expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();
 expect(r.unhandled.some(u=>u.raw==='\\unrecognized')).toBe(true);
 expect(r.atoms.some(a=>a.kind==='cell'&&source.slice(a.span.start,a.span.end)==='x')).toBe(true);
});
