import {test,expect} from 'vitest';
import {convert} from '../packages/core/src/convert';
const options={mode:'math' as const,paragraphIndent:0};
test.each([String.raw`\frac{a}{}`,String.raw`\frac{}{b}`,String.raw`\frac{}{}`,String.raw`\frac{\quad}{b}`,String.raw`\frac{a}{\text{ }}`,String.raw`\frac{a}{\mathrm{}}`,String.raw`x+\frac{a}{\frac{}{b}}+y`])('empty fraction fields remain incomplete with visible content: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='math-empty-fraction-field')).toBe(true);
 expect(r.unicode||r.preview?.unicode).toContain('⠿');
 expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
 for(const u of r.unhandled)expect(source.slice(u.span.start,u.span.end)).toBe(u.raw);
});
test.each([String.raw`\frac{0}{1}`,String.raw`\frac{a}{b}`,String.raw`\frac{\text{因为}a}{b}`,String.raw`\frac{a}{\frac{b}{c}}`])('nonempty fraction fields retain complete conversion: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.diagnostics.some(d=>d.code==='math-empty-fraction-field')).toBe(false);
});
test.each([String.raw`\sqrt{}`,String.raw`\sqrt[3]{\quad}`,String.raw`\sqrt{\text{ }}`,String.raw`x+\sqrt{\mathrm{}}+y`])('empty radicands remain visible for review: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.diagnostics.some(d=>d.code==='math-empty-root-field')).toBe(true);expect(r.unicode||r.preview?.unicode).toContain('⠿');expect(r.document.source).toBe(source);
});
test('an empty optional root index does not make a nonempty radicand incomplete',()=>{
 expect(convert(String.raw`\sqrt[]{x}`,options).complete).toBe(true);
});
