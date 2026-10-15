import {expect,test} from 'vitest';
import {convert} from '../packages/core/src/convert';
import {braille} from '../packages/core/src/rules/math-symbols';
const options={mode:'math' as const,paragraphIndent:0};

test.each([String.raw`A^\top`,String.raw`A^{\top}`,'A^⊤'])('conventional transpose %s uses the checked matrix modifier',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);
 expect(r.unicode).toBe(braille(['6','1','46','2345']));
 expect(r.document.source).toBe(source);expect(r.unhandled).toEqual([]);
 expect(convert(source,{paragraphIndent:0}).unicode).toBe(r.unicode);
});
test('transpose retains a preexisting index and whole-expression scope',()=>{
 const indexed=convert(String.raw`A_1^\top`,options);expect(indexed.complete).toBe(true);
 expect(indexed.unicode).toBe(braille(['6','1','16','2','46','2345']));
 const compound=convert(String.raw`(A+B)^\top`,options);expect(compound.complete).toBe(true);
 expect(compound.unicode).toBe(convert('(A+B)',options).unicode+braille(['46','2345']));
 expect(convert(String.raw`{A+B}^\top`,options).unicode).toBe(compound.unicode);
 expect(convert('{x+y}^2',options).unicode).toBe(convert('(x+y)^2',options).unicode);
});
test('transpose of a spatial matrix follows its final row',()=>{
 const source=String.raw`\begin{pmatrix}a\\b\end{pmatrix}^{\top}`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.lines).toHaveLength(2);
 expect(r.lines.at(-1)?.endsWith(braille(['345','46','2345']))).toBe(true);
});
test.each([String.raw`\top`,String.raw`A_\top`,String.raw`A^{\top+1}`,String.raw`1^\top`,String.raw`)^\top`,String.raw`{}^\top`])('other role remains visible rather than becoming transpose: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);
 expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
test('an ordinary T exponent remains distinct from the transpose normalization',()=>{
 const t=convert('A^T',options),transpose=convert(String.raw`A^\top`,options);
 expect(t.complete).toBe(true);expect(t.unicode).not.toBe(transpose.unicode);
});
test('an unclassified top stays inside its original lower-index field',()=>{
 const r=convert(String.raw`A_\top`,options);expect(r.complete).toBe(false);
 expect(r.unicode).toBe(braille(['6','1','16','123456','156']));
 expect(r.unhandled).toHaveLength(1);
});
test('generated composite-base parentheses stay with their mathematical payload when wrapping',()=>{
 const source=String.raw`abcdefghi{A+B}^\top`,r=convert(source,{...options,columns:12});
 expect(r.complete).toBe(true);expect(r.lines.length).toBeGreaterThan(1);
 expect(r.lines.every(line=>!line.endsWith(braille(['126','6'])))).toBe(true);
 expect(r.lines.every(line=>!line.startsWith(braille(['345'])))).toBe(true);
 expect(r.atoms).toEqual(convert(source,{...options,columns:100}).atoms);
});
test.each([['Tr','1246 6 2345 1235'],['SP','1246 6 234 1234']])('trace command %s uses the explicit standard spelling',(name,dots)=>{
 const r=convert(`\\${name}A`,options); // TeX requires a command boundary before A.
 expect(r.complete).toBe(false);
 const proper=convert(`\\${name} A`,options);expect(proper.complete).toBe(true);
 expect(proper.unicode).toBe(braille([...dots.split(' '),'6','1']));
 expect(proper.unicode).toBe(convert(`\\operatorname{${name}} A`,options).unicode);
});
test('zero vector retains its zero and checked single-name arrow',()=>{
 const r=convert(String.raw`\vec{0}`,options);expect(r.complete).toBe(true);
 expect(r.unicode).toBe(braille(['3456','245','45','25','2','0']));
});
test.each([String.raw`\vec{\mathrm{AB}}`,String.raw`\vec{\mathbf{a}}`])('font-wrapped vector name retains the font and arrow: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);
 expect(r.unicode.endsWith(braille(['45','25',source.includes('AB')?'23':'2','156','0']))).toBe(true);
});
test('an indexed vector groups the complete marked expression',()=>{
 const r=convert(String.raw`\vec{a_i}`,options);expect(r.complete).toBe(true);
 expect(r.unicode).toBe(braille(['12346','56','1','16','56','24','156','13456','45','25','2','156','0']));
});
