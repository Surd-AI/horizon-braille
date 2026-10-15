import {test,expect} from 'vitest';
import {convert} from '../packages/core/src/convert';
const options={mode:'math' as const,paragraphIndent:0};
test.each([String.raw`\quad`,String.raw`\qquad`,String.raw`\quad\displaystyle`,String.raw`\mathrm{}`,String.raw`\mathit{\quad}`,String.raw`\left.\qquad\right.`])('format-only %s retains visible labelled source',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);
 expect(r.unicode||r.preview?.unicode).toMatch(/[^\u2800\s]/);expect(r.diagnostics.some(d=>d.code==='math-empty-expression')).toBe(true);
 expect(r.atoms.some(a=>a.ruleId==='empty-content-source')).toBe(true);expect(r.unhandled.some(u=>u.raw===source)).toBe(true);
});
test.each([String.raw`$\quad$`,String.raw`$$\qquad$$`,String.raw`abc $\displaystyle\quad$ def`])('format-only document scope %s remains visible with source mapping',source=>{
 const r=convert(source,{mode:'document',paragraphIndent:0});expect(r.complete).toBe(false);expect(r.document.source).toBe(source);
 expect(r.atoms.some(a=>a.ruleId==='empty-content-source')).toBe(true);expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
});
test('multiline format-only source retains real line boundaries and exact offsets',()=>{
 const source=String.raw`\quad`+'\r\n'+String.raw`\qquad`,r=convert(source,options);expect(r.complete).toBe(false);
 expect(r.atoms.some(a=>a.kind==='line-break'&&source.slice(a.span.start,a.span.end)==='\r\n')).toBe(true);
 expect(r.diagnostics.some(d=>d.code==='text-unhandled'&&/U\+000[AD]/.test(d.message))).toBe(false);
 expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
});
test.each(['', ' ', '\r\n'])('intentional empty/whitespace input remains empty: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.diagnostics.some(d=>d.code==='math-empty-expression')).toBe(false);
});
test.each([String.raw`a\quad b`,String.raw`\frac{a\qquad b}{c}`,String.raw`\text{a b}`,String.raw`\hspace{2em}`])('visible content or explicit spacing description %s retains normal conversion',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.diagnostics.some(d=>d.code==='math-empty-expression')).toBe(false);
});
