import {test,expect} from 'vitest';
import {convert} from '../packages/core/src/convert';
const options={mode:'math' as const,paragraphIndent:0};
const entries=[['nrightarrow','↛'],['nleftarrow','↚'],['nleftrightarrow','↮'],['nRightarrow','⇏'],['nLeftarrow','⇍'],['nLeftrightarrow','⇎'],['nearrow','↗'],['nwarrow','↖'],['searrow','↘'],['swarrow','↙'],['permil','‰'],['sphericalangle','∢'],['daleth','ℸ'],['backsim','∽'],['asymp','≍']];
test.each(entries)('%s preserves distinct readable glyph and matching Unicode',(name,glyph)=>{
 const source=`a\\${name} b`,r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.unicode).toBe(convert(`a${glyph}b`,options).unicode);
 expect(r.diagnostics.some(d=>d.code==='math-symbol-described')).toBe(true);
 expect(r.metadata.chineseWords).toEqual([]);
 expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
 expect(convert(source,{...options,symbolPolicy:'review-unmapped'}).complete).toBe(false);
});
test('negation, line count and direction are not collapsed',()=>{
 const names=['nrightarrow','nleftarrow','nleftrightarrow','nRightarrow','nLeftarrow','nLeftrightarrow','nearrow','nwarrow','searrow','swarrow'];
 expect(new Set(names.map(n=>convert(`a\\${n} b`,options).unicode)).size).toBe(names.length);
 expect(convert(String.raw`a\nRightarrow b`,options).unicode).not.toBe(convert(String.raw`a\Rightarrow b`,options).unicode);
 expect(convert(String.raw`a\backsim b`,options).unicode).not.toBe(convert(String.raw`a\sim b`,options).unicode);
});
test('large upward triangle preserves its explicit command variation',()=>{
 const r=convert(String.raw`\bigtriangleup ABC`,options);expect(r.complete).toBe(true);
 expect(r.unicode).not.toBe(convert(String.raw`\triangle ABC`,options).unicode);
});
test('varvdots preserves the checked ellipsis rule and matrix placement',()=>{
 const source=String.raw`\begin{pmatrix}a&\varvdots\\b&c\end{pmatrix}`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(convert(source.replace('varvdots','vdots'),options).unicode);
 expect(r.document.source).toBe(source);
});
test.each([String.raw`\frac{a\nRightarrow b}{c\asymp d}`,String.raw`x^{\nearrow}`,String.raw`\begin{aligned}\text{因为}&a\backsim b\\\text{所以}&c\sphericalangle d\end{aligned}`])('glyphs retain compound fields and Chinese text: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 for(const w of r.metadata.chineseWords)expect(source.slice(w.span.start,w.span.end)).toBe(w.raw);
});
test('recognized negation does not hide unknown neighboring content',()=>{
 const source=String.raw`a\nRightarrow\unknown{b}`,r=convert(source,options);expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toContain('⠿');expect(r.document.source).toBe(source);
});
test('document scanner recognizes described glyphs',()=>{
 for(const source of [String.raw`a\nRightarrow b`,String.raw`a\nearrow b`,String.raw`10\permil`])expect(convert(source,{mode:'document',paragraphIndent:0}).complete).toBe(true);
});
