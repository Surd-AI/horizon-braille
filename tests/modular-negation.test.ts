import {test,expect} from 'vitest';
import {convert} from '../packages/core/src/convert';
import {braille} from '../packages/core/src/rules/math-symbols';
const options={mode:'math' as const,paragraphIndent:0};
test.each([String.raw`a\bmod n`,String.raw`a\mod n`,String.raw`a\bmod -n`])('modular operation retains operands and original source: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='math-symbol-described')).toBe(true);
 expect(convert(source,{paragraphIndent:0}).complete).toBe(true);
 expect(r.atoms.every(a=>a.span.start>=0 && a.span.end<=source.length)).toBe(true);
});
test.each([String.raw`a\equiv b\pmod{n}`,String.raw`a\equiv b\pmod{x+1}`,String.raw`a\equiv b\pod{n}`,String.raw`\frac{a\bmod n}{2}`,String.raw`\begin{aligned}a&\equiv b\pmod{n}\\x&=a\bmod n\end{aligned}`])('modular annotations retain their whole argument and nested fields: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(convert(source,{paragraphIndent:0}).complete).toBe(true);
 expect(r.metadata.chineseWords).toEqual([]);
});
test('pod preserves parentheses without inventing a modulo label',()=>{
 expect(convert(String.raw`\pod{x+1}`,options).unicode).toBe(convert('(x+1)',options).unicode);
 expect(convert(String.raw`\pmod{x+1}`,options).unicode).not.toBe(convert('(x+1)',options).unicode);
});
test('mod word-form and binary modulo retain their distinct source roles',()=>{
 expect(convert(String.raw`a\mod n`,options).unicode).not.toBe(convert(String.raw`a\bmod n`,options).unicode);
});
test('logical negation commands and glyph remain equivalent and distinct from subtraction',()=>{
 const r=convert(String.raw`\neg P`,options);expect(r.complete).toBe(true);
 expect(r.unicode).toBe(convert(String.raw`\lnot P`,options).unicode);expect(r.unicode).toBe(convert('¬P',options).unicode);
 expect(r.unicode).not.toBe(convert('-P',options).unicode);
});
test('negation retains parentheses and does not perform De Morgan rewriting',()=>{
 const source=String.raw`\neg(P\wedge Q)`,r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.diagnostics.filter(d=>d.code==='math-symbol-described')).toHaveLength(2);
 expect(r.unicode.endsWith(braille(['345']))).toBe(true);
});
test.each([String.raw`\pmod`,String.raw`\pmod{}`,String.raw`\pmod{\quad}`,String.raw`a\pmod{\unknown}`,String.raw`a\pod{\unknown}`])('missing or unknown modular fields remain visible: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toContain('⠿');
});
