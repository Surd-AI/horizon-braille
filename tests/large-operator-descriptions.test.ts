import {test,expect} from 'vitest';
import {convert} from '../packages/core/src/convert';
import {braille} from '../packages/core/src/rules/math-symbols';
const options={mode:'math' as const,paragraphIndent:0};
const entries=[['bigoplus','⨁'],['bigotimes','⨂'],['bigodot','⨀'],['bigwedge','⋀'],['bigvee','⋁'],['coprod','∐'],['biguplus','⨄'],['bigsqcup','⨆']];
test.each(entries)('%s retains its glyph identity and limit fields',(command,glyph)=>{
 const source=`\\${command}_{i=1}^{n} A_i`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.unicode).toBe(convert(`${glyph}_{i=1}^{n} A_i`,options).unicode);
 expect(r.diagnostics.some(d=>d.code==='math-symbol-described')).toBe(true);
 const cells=r.atoms.filter(a=>a.kind==='cell').map(a=>a.cells).join('');
 expect(cells).toContain(braille(['46','16']));expect(cells).toContain(braille(['46','34']));
 expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
 expect(r.metadata.chineseWords).toEqual([]);
 expect(convert(source,{...options,symbolPolicy:'review-unmapped'}).complete).toBe(false);
});
test('large glyph names remain distinct from ordinary binary counterparts',()=>{
 for(const [big,small] of [['bigoplus','oplus'],['bigotimes','otimes'],['bigodot','odot'],['bigwedge','wedge'],['bigvee','vee']])
  expect(convert(`\\${big} A`,options).unicode).not.toBe(convert(`\\${small} A`,options).unicode);
});
test.each([String.raw`\frac{\bigoplus_{i=1}^{n} A_i}{B}`,String.raw`x^{\bigwedge_{i=1}^{n} A_i}`,String.raw`\begin{aligned}\text{因为}&\coprod_{i=1}^{n} A_i\\\text{所以}&\bigvee_{i=1}^{n} B_i\end{aligned}`])('compound operator bodies retain fields and text: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 for(const w of r.metadata.chineseWords)expect(source.slice(w.span.start,w.span.end)).toBe(w.raw);
});
test('unknown limit content remains visible and incomplete',()=>{
 const source=String.raw`\bigoplus_{\unknown{a}}^{n} A`,r=convert(source,options);
 expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toContain('⠿');expect(r.document.source).toBe(source);
});
test('intop reuses the checked integral with compound limit scopes',()=>{
 const source=String.raw`\intop_{a+b}^{c+d} f(x)\,dx`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(convert(String.raw`\int_{a+b}^{c+d} f(x)\,dx`,options).unicode);
});
test('document mode recognizes the large operator without math delimiters',()=>{
 expect(convert(String.raw`\bigoplus_{i=1}^{n} A_i`,{mode:'document',paragraphIndent:0}).complete).toBe(true);
});
