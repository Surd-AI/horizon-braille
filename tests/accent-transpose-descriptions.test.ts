import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {parseMath} from '../packages/core/src/parser/math';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={mode:'math' as const,paragraphIndent:0};
test.each([String.raw`A^{\intercal}`,String.raw`(A+B)^{\intercal}`,String.raw`\begin{pmatrix}a&b\\c&d\end{pmatrix}^{\intercal}`])('intercal in the transpose position uses the checked transpose: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.unicode).toBe(convert(source.replace('intercal','top'),options).unicode);
 expect(r.diagnostics.some(d=>d.code==='math-transpose-normalized')).toBe(true);
 expect(convert(source,{...options,symbolPolicy:'review-unmapped'}).complete).toBe(true);
});
test('intercal outside transpose positions retains glyph description without inference',()=>{
 for(const source of [String.raw`A\intercal B`,String.raw`1^{\intercal}`]){
  const r=convert(source,options);expect(r.complete).toBe(true);
  expect(r.diagnostics.some(d=>d.code==='math-transpose-normalized')).toBe(false);
  expect(r.diagnostics.some(d=>d.code==='math-symbol-described')).toBe(true);
  expect(convert(source,{...options,symbolPolicy:'review-unmapped'}).complete).toBe(false);
 }
 expect(convert('A⊺B',options).unicode).toBe(convert(String.raw`A\intercal B`,options).unicode);
});
test.each(['acute','grave','mathring'])('%s retains the exact body and an above-mark description',command=>{
 const source=`\\${command}{a+b}`,r=convert(source,options),tree=parseMath(source).body;
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(tree.kind).toBe('sequence');if(tree.kind==='sequence'){
  const n=tree.children[0];expect(n.kind).toBe('annotation');
  if(n.kind==='annotation'){expect(n.direction).toBe('above');expect(n.body.raw).toBe('{a+b}');expect(n.mark.raw).toBe(`\\${command}`);}
 }
 expect(r.diagnostics.some(d=>d.code==='math-symbol-described')).toBe(true);
 expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
 expect(convert(source,{...options,symbolPolicy:'review-unmapped'}).complete).toBe(false);
 expect(convert(source,{mode:'document',paragraphIndent:0}).complete).toBe(true);
});
test('acute/grave/ring marks remain distinct and do not consume following content',()=>{
 expect(new Set(['acute','grave','mathring'].map(n=>convert(`\\${n}{a+b}c`,options).unicode)).size).toBe(3);
 const tree=parseMath(String.raw`\acute ab`).body;
 if(tree.kind==='sequence'){expect(tree.children).toHaveLength(2);const first=tree.children[0];if(first.kind==='annotation')expect(first.body.raw).toBe('a');expect(tree.children[1].raw).toBe('b');}
});
test.each([String.raw`\acute{}`,String.raw`\grave`,String.raw`\mathring{\unknown}`,String.raw`A^{\intercal\unknown}`])('invalid and unknown bodies retain visible output: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toContain('⠿');expect(r.document.source).toBe(source);
});
test('accent bodies retain editable Chinese words without modifying captions',()=>{
 const source=String.raw`\begin{aligned}\acute{\text{因为}A}&=B\\\grave{\text{所以}C}&=D\end{aligned}`,r=encodeDocument(source,options),start=source.indexOf('因为');
 expect(r.complete).toBe(true);for(const w of r.metadata.chineseWords)expect(source.slice(w.span.start,w.span.end)).toBe(w.raw);
 const edited=applyManualBraille(r,[{start,end:start+2,cells:'⠁⠃'}]);
 expect(edited.atoms.filter(a=>a.ruleId==='editorial-symbol-description')).toEqual(r.atoms.filter(a=>a.ruleId==='editorial-symbol-description'));
});
test('nested accent/fraction/script fields retain source and output',()=>{
 const source=String.raw`\frac{\acute{a+b}}{x^{\grave{y}}}+\mathring{\mathbf{A}}`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
});
