import {expect,test} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {applyManualBraille} from '../packages/core/src/manual-braille';
import {braille as b} from '../packages/core/src/rules/math-symbols';
const options={mode:'math' as const,paragraphIndent:0};

// GB/T18028-2010 §6.5.1 items 23–24 and §6.5.2.5, printed pp14–15.
test('circled numeral retains its numeral and trailing enclosure',()=>{
 const r=convert(String.raw`\textcircled{1}`,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(b(['4','3456','1','6','356']));
});
test('textcircled uses literal text rather than treating letters as variables',()=>{
 const r=convert(String.raw`\textcircled{a}`,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(b(['4','56','1','6','356']));
});
test('the complete boxed script precedes the enclosing square',()=>{
 const r=convert(String.raw`\boxed{y^{+}}`,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(b(['12346','56','13456','34','235','156','13456','6','2356']));
});
test.each([String.raw`\boxed{a+b}`,String.raw`\boxed{\frac{1}{2}}`,String.raw`\textcircled{ab}`,String.raw`\textcircled{因为}`,String.raw`\textcircled{a $x^2$ b}`])('whole enclosure scope and exact source are preserved: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.unicode.endsWith(b(['6',source.startsWith('\\boxed')?'2356':'356']))).toBe(true);
 expect(r.atoms.every(a=>a.span.start>=0 && a.span.end<=source.length)).toBe(true);
 expect(convert(source,{paragraphIndent:0}).unicode).toBe(r.unicode);
});
test.each([String.raw`\boxed{}`,String.raw`\textcircled{}`,String.raw`\boxed{\unknown}`,String.raw`\textcircled{a $\unknown$ b}`])('empty or unresolved enclosure remains visible: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toContain('⠿');expect(r.document.source).toBe(source);
});
test('Chinese literal edit retains circled structure and neighboring mathematics',()=>{
 const source=String.raw`\textcircled{因为}x+1`,encoded=encodeDocument(source,options),start=source.indexOf('因为');
 const edited=applyManualBraille(encoded,[{start,end:start+2,cells:'⠁⠃'}]);
 expect(edited.document.source).toBe(source);
 const structural=(r:typeof encoded)=>r.atoms.flatMap(a=>a.kind==='cell' && a.sourceRole==='structure'?[a.cells]:[]);
 expect(structural(edited)).toEqual(structural(encoded));
 expect(edited.atoms.some(a=>a.kind==='cell' && a.cells==='⠁⠃')).toBe(true);
});
test('long boxed expression keeps all encoded cells and protected enclosure endings',()=>{
 const source=String.raw`\boxed{abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz}`;
 const wide=convert(source,{...options,columns:200}),narrow=convert(source,{...options,columns:30});
 expect(narrow.complete).toBe(true);expect(narrow.lines.length).toBeGreaterThan(1);
 expect(narrow.atoms.flatMap(a=>a.kind==='cell'?[a.cells]:[])).toEqual(wide.atoms.flatMap(a=>a.kind==='cell'?[a.cells]:[]));
 expect(narrow.lines.at(-1)?.endsWith(b(['13456','6','2356']))).toBe(true);
});
test.each([String.raw`\boxed{\begin{aligned}x&=1\\y&=2\end{aligned}}`,String.raw`\boxed{\begin{pmatrix}a\\b\end{pmatrix}}`,String.raw`\boxed{\begin{cases}x&x>0\\y&x<0\end{cases}}`,String.raw`\begin{pmatrix}a\end{pmatrix}+\boxed{\begin{pmatrix}b\\c\end{pmatrix}}`])('enclosed rows retain row controls and one whole enclosing scope: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 if(source.includes('pmatrix'))expect(r.lines.length).toBeGreaterThan(1);
 else expect(r.unicode).toContain(b(['46','1256']));
 expect(r.lines.at(-1)?.endsWith(b(['13456','6','2356']))).toBe(true);
 expect(r.diagnostics.some(d=>d.code==='layout-conflicting-control')).toBe(false);
});
test('a boxed genuinely nested matrix still requires its block profile',()=>{
 const r=convert(String.raw`\boxed{\begin{pmatrix}\begin{pmatrix}a\\b\end{pmatrix}\end{pmatrix}}`,options);
 expect(r.complete).toBe(false);expect(r.diagnostics.some(d=>d.code==='math-matrix-context-unverified')).toBe(true);
});
