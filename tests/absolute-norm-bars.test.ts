import {expect,test} from 'vitest';
import {convert} from '../packages/core/src/convert';
import {braille as b} from '../packages/core/src/rules/math-symbols';
const options={mode:'math' as const,paragraphIndent:0};
// GB/T18028-2010 §6.2.1 items 11–12 and §6.2.2.1/.2, printed p9.
test.each([String.raw`\Vert x\Vert`,String.raw`\lVert x\rVert`,String.raw`\|x\|`,'‖x‖',String.raw`\left\Vert x\right\Vert`,String.raw`\left\lVert x\right\rVert`])('heavy absolute-value bars retain their own cells: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.unicode).toBe(b(['456','2','56','1346','456','2']));
 expect(convert(source,{paragraphIndent:0}).complete).toBe(true);expect(convert(source,{paragraphIndent:0}).unicode).toBe(r.unicode);
 expect(r.document.source).toBe(source);
});
test('single named bars remain distinct from heavy bars',()=>{
 const r=convert(String.raw`\lvert x\rvert`,options);expect(r.complete).toBe(true);expect(r.unicode).toBe(b(['456','56','1346','456']));
 expect(convert(String.raw`\lvert x\rvert`,{paragraphIndent:0}).unicode).toBe(r.unicode);
});
test.each([String.raw`\lvert-x\rvert`,String.raw`\lVert-x\rVert`,String.raw`| -x |`])('unary sign after an opening bar has no inserted binary-operation blank: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.unicode).not.toContain('⠀');
});
test('nested heavy and single bars keep independent closing states',()=>{
 const r=convert(String.raw`\lVert\lvert x\rvert+y\rVert`,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(b(['456','2','456','56','1346','456','0','235','56','13456','456','2']));
});
test.each([String.raw`\lVert x\rVert!`,String.raw`\Vert x\Vert!`,String.raw`\lvert x\rvert!`])('closed bars provide a factorial operand: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.unicode.endsWith(b(['6','235']))).toBe(true);
});
test('a scripted closing bar preserves closure before a following factorial',()=>{
 const r=convert(String.raw`\lVert x\rVert^2!`,options);expect(r.complete).toBe(true);expect(r.diagnostics.some(d=>d.code==='math-unmatched-bar')).toBe(false);
});
test.each([String.raw`\rVert x`,String.raw`\lVert x`,String.raw`\lvert x\rVert`,String.raw`\lVert x\rvert`])('explicit malformed pairs remain incomplete: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='math-unmatched-bar')).toBe(true);expect(r.unicode||r.preview?.unicode).toContain('⠿');
});
test.each([String.raw`\Vert`,String.raw`\|`,String.raw`P(A\|B)`])('generic bar glyphs are not forced into an unclosed-norm interpretation: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='math-unmatched-bar')).toBe(false);
});
test.each([String.raw`\lVert\rVert`,String.raw`\lvert{}\rvert`])('empty bar bodies stay visible and incomplete: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toContain('⠿');expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='math-empty-bar-body')).toBe(true);
});
test('Unicode parallel lines are not heavy absolute-value bars',()=>{
 const r=convert('a∥b',options);expect(r.complete).toBe(true);expect(r.unicode).toBe(b(['56','1','0','123','123','56','12']));
 expect(r.unicode).not.toContain(b(['456','2']));
});
test('long norms preserve all encoded cells while wrapping',()=>{
 const source=String.raw`\lVert abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz\rVert`,wide=convert(source,{...options,columns:200}),narrow=convert(source,{...options,columns:30});
 expect(narrow.complete).toBe(true);expect(narrow.lines.length).toBeGreaterThan(1);
 expect(narrow.atoms.flatMap(a=>a.kind==='cell'?[a.cells]:[])).toEqual(wide.atoms.flatMap(a=>a.kind==='cell'?[a.cells]:[]));
 expect(narrow.atoms[0].kind==='cell' && narrow.atoms[1].kind==='cell' && narrow.atoms[0].group===narrow.atoms[1].group).toBe(true);
 const cells=narrow.atoms.filter(a=>a.kind==='cell');expect(cells.at(-1)!.group).toBe(cells.at(-2)!.group);
});
test('a norm around a matrix keeps row controls outside its atomic opening frame',()=>{
 const r=convert(String.raw`\begin{pmatrix}a\end{pmatrix}+\lVert\begin{pmatrix}b\\c\end{pmatrix}\rVert`,options);
 expect(r.complete).toBe(true);expect(r.lines.filter(l=>l==='')).toHaveLength(1);
 expect(r.diagnostics.some(d=>d.code==='layout-conflicting-control')).toBe(false);
});
