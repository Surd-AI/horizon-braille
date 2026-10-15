import {test,expect} from 'vitest';
import {convert} from '../packages/core/src/convert';
const options={mode:'math' as const,paragraphIndent:0};
test.each([['smallsetminus','setminus'],['smallint','int'],['shortmid','mid'],['shortparallel','parallel']])('%s retains the checked role and points of %s',(alias,base)=>{
 const source=`A\\${alias} B`,r=convert(source,options);expect(r.complete).toBe(true);
 expect(r.unicode).toBe(convert(`A\\${base} B`,options).unicode);expect(r.document.source).toBe(source);
 expect(convert(source,{paragraphIndent:0}).complete).toBe(true);
 expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
});
test('small integral keeps the integral limit/index profile',()=>{
 const source=String.raw`\smallint_0^1 x\,dx`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(convert(String.raw`\int_0^1 x\,dx`,options).unicode);
});
test.each(['colon','thicksim','thickapprox','frown','smile','smallfrown','smallsmile'])('%s retains readable glyph/weight/form rather than an unknown command',name=>{
 const source=`a\\${name} b`,r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='math-symbol-described')).toBe(true);
 expect(r.metadata.chineseWords).toEqual([]);
 expect(convert(source,{...options,symbolPolicy:'review-unmapped'}).complete).toBe(false);
});
test('arc direction, relative size and wave thickness remain distinguishable',()=>{
 const names=['frown','smile','smallfrown','smallsmile','thicksim','thickapprox'];
 const values=names.map(n=>convert(`a\\${n} b`,options).unicode);expect(new Set(values).size).toBe(names.length);
 for(const n of ['sim','approx'])expect(values).not.toContain(convert(`a\\${n} b`,options).unicode);
 expect(convert('a⌢b',options).unicode).toBe(convert(String.raw`a\frown b`,options).unicode);
 expect(convert('a⌣b',options).unicode).toBe(convert(String.raw`a\smile b`,options).unicode);
});
test.each([String.raw`\frac{A\smallsetminus B}{c\thicksim d}`,String.raw`f\colon X\to Y`,String.raw`\begin{aligned}\text{因为}&a\frown b\\\text{所以}&c\smile d\end{aligned}`])('aliases/descriptions retain fields and prose: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 for(const w of r.metadata.chineseWords)expect(source.slice(w.span.start,w.span.end)).toBe(w.raw);
});
test('a recognized variant does not discard unknown neighboring contents',()=>{
 const source=String.raw`A\smallsetminus\unknown{B}`,r=convert(source,options);
 expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toContain('⠿');expect(r.document.source).toBe(source);
});
