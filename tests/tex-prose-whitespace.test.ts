import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={mode:'math' as const,columns:30,paragraphIndent:0};
test.each(['\n','\r\n','\r','\t','   '])('soft TeX whitespace %j keeps one logical space and original offsets',gap=>{
 const source='\\text{abc'+gap+'def}',r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);expect(r.unicode).toBe(convert(String.raw`\text{abc def}`,options).unicode);
 const d=r.diagnostics.find(d=>d.code==='text-tex-whitespace-adapted')!;expect(source.slice(d.span.start,d.span.end)).toBe(gap);
});
test('paragraph columns retain paragraph boundaries rather than silently joining prose',()=>{
 const source='\\begin{tabular}{p{2cm}}abc\n\ndef\\end{tabular}',r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);expect(r.atoms.some(a=>a.ruleId==='editorial-tex-paragraph')).toBe(true);
 expect(r.unicode).not.toBe(convert(source.replace('\n\n',' '),options).unicode);
 expect(convert(source,{...options,mode:'document'}).complete).toBe(true);
});
test('an unclosed table cannot hide a following paragraph or explicit formula',()=>{
 const source='\\begin{tabular}{p{2cm}}abc\n\nnext $x^2$',r=convert(source,{...options,mode:'document'});
 expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.document.nodes.some(n=>n.kind==='inline-math'&&n.raw==='$x^2$')).toBe(true);
});
test.each(['\\text{abc\n\ndef}','\\begin{tabular}{c}abc\n\ndef\\end{tabular}'])('restricted inline paragraph stays visibly reviewable: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();expect(r.diagnostics.some(d=>d.code==='text-tex-paragraph-unverified')).toBe(true);
});
test('native source line breaks outside TeX prose stay actual line boundaries',()=>{
 const source='abc\n\ndef',r=convert(source,{mode:'document',paragraphIndent:0});expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='text-tex-whitespace-adapted')).toBe(false);expect(r.lines.length).toBeGreaterThan(1);
});
test('Chinese edits preserve paragraph descriptions and source words',()=>{
 const source='\\begin{tabular}{p{2cm}}因为\n\n所以\\end{tabular}',r=encodeDocument(source,options),start=source.indexOf('因为');expect(r.complete).toBe(true);
 const edited=applyManualBraille(r,[{start,end:start+2,cells:'⠁⠃'}]);expect(edited.atoms.filter(a=>a.ruleId==='editorial-tex-paragraph')).toEqual(r.atoms.filter(a=>a.ruleId==='editorial-tex-paragraph'));
});
test('paragraph mode follows logical columns and nested text fonts',()=>{
 for(const source of ['\\begin{tabular}{ccp{2cm}}\\multicolumn{2}{c}{Title}&abc\n\ndef\\end{tabular}','\\begin{tabular}{p{2cm}}\\textbf{abc\n\ndef}\\end{tabular}']) {
  const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);expect(r.atoms.some(a=>a.ruleId==='editorial-tex-paragraph')).toBe(true);
 }
});
