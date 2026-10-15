import {expect,test} from 'vitest';
import {convert} from '../packages/core/src/convert';
import {braille as b} from '../packages/core/src/rules/math-symbols';
const options={mode:'math' as const,columns:30,paragraphIndent:0};

test('matrix addition follows independently transcribed row and blank-line rules §§6.17.2.1/.5/.6',()=>{
 const source=String.raw`\begin{pmatrix}a\\b\end{pmatrix}+\begin{pmatrix}c\\d\end{pmatrix}`;
 const r=convert(source,options);
 expect(r.complete).toBe(true);
 expect(r.lines).toEqual([b(['126','56','1','345']),b(['126','56','12','345','0','235']),'',b(['126','56','14','345']),b(['126','56','145','345'])]);
 expect(r.document.source).toBe(source);
});
test('matrix flow survives font and script wrappers before the next operand',()=>{
 const r=convert(String.raw`\mathbf{\begin{pmatrix}a\end{pmatrix}}^2+\begin{pmatrix}b\end{pmatrix}`,options);
 expect(r.complete).toBe(true);expect(r.lines.filter(line=>line==='')).toHaveLength(1);
 expect(r.lines[0]).toContain(b(['34','23','0','235']));
});
test('matrices in independent aligned rows do not acquire a false nested-matrix warning',()=>{
 const source=String.raw`\begin{aligned}A&=\begin{pmatrix}a\\b\end{pmatrix}\\B&=\begin{pmatrix}c\\d\end{pmatrix}\end{aligned}`;
 const r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.unhandled).toEqual([]);expect(r.document.source).toBe(source);
 expect(r.lines.filter(line=>line==='')).toHaveLength(0);
 expect(r.lines).toHaveLength(4);
 expect(r.lines[0]).toBe(b(['6','1','0','2356','126','56','1','345']));
 expect(r.lines[2]).toBe(b(['6','12','0','2356','126','56','14','345']));
});
test('a genuinely nested matrix remains incomplete until its block profile is implemented',()=>{
 const r=convert(String.raw`\begin{pmatrix}\begin{pmatrix}a\end{pmatrix}\\b\end{pmatrix}`,options);
 expect(r.complete).toBe(false);expect(r.diagnostics.some(d=>d.code==='math-matrix-context-unverified')).toBe(true);
});
test('a root prefixes the first matrix row and closes after the last row by §6.17.2.5',()=>{
 const source=String.raw`V=\sqrt{\begin{vmatrix}a\\b\end{vmatrix}}`;
 const r=convert(source,options);
 expect(r.complete).toBe(true);
 expect(r.lines).toEqual([b(['6','1236','0','2356','146','156','456','56','1','456']),b(['456','56','12','456','1456'])]);
 expect(r.document.source).toBe(source);
});
test('a second matrix inside a root keeps its root prefix after the separating blank line',()=>{
 const r=convert(String.raw`\begin{vmatrix}a\end{vmatrix}+\sqrt{\begin{vmatrix}b\end{vmatrix}}`,options);
 expect(r.complete).toBe(true);
 expect(r.lines).toEqual([b(['456','56','1','456','0','235']),'',b(['146','156','456','56','12','456','1456'])]);
});
