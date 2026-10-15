import {test,expect} from 'vitest';
import {convert} from '../packages/core/src/convert';
import {braille} from '../packages/core/src/rules/math-symbols';
const options={mode:'math' as const,paragraphIndent:0};

test.each([['lfloor','rfloor','⌊','⌋'],['lceil','rceil','⌈','⌉']])('paired %s/%s keep their expression and glyph identity',(left,right,l,r)=>{
 const source=`\\${left}-1.5\\${right}`,encoded=convert(source,options);
 expect(encoded.complete).toBe(true);expect(encoded.document.source).toBe(source);
 expect(encoded.unicode).toBe(convert(`${l}-1.5${r}`,options).unicode);
 expect(encoded.unicode).not.toBe(convert('(-1.5)',options).unicode);
 expect(convert(source,{paragraphIndent:0}).complete).toBe(true);
 expect(encoded.unicode).toBe(convert(`\\left\\${left}-1.5\\right\\${right}`,options).unicode);
 expect(convert(`\\left${l}-1.5\\right${r}`,{paragraphIndent:0}).complete).toBe(true);
 expect(encoded.unhandled).toEqual([]);
});

test.each([String.raw`\lfloor\frac{x+1}{2}\rfloor^2`,String.raw`\lceil\lfloor-1.5\rfloor\rceil`,String.raw`\lfloor x\rfloor!`,String.raw`\begin{aligned}\text{因为}&n=\lfloor x\rfloor\\\text{所以}&m=\lceil x\rceil\end{aligned}`])('rounding fields preserve nesting, scripts and mixed alignment: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.unicode).toBeTruthy();expect(r.document.source).toBe(source);
 expect(r.atoms.every(a=>a.span.start>=0 && a.span.end<=source.length)).toBe(true);
});

test.each([String.raw`\lfloor x`,String.raw`x\rfloor`,String.raw`\lfloor x\rceil`,String.raw`\lfloor\rfloor`,String.raw`\lceil\quad\rceil`])('invalid rounding structure remains visible: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toBeTruthy();
 expect(r.document.source).toBe(source);expect(r.diagnostics.some(d=>d.code==='math-unmatched-rounding-delimiter'||d.code==='math-empty-rounding-body')).toBe(true);
});

test('unknown floor argument keeps both delimiters and readable unknown source',()=>{
 const source=String.raw`\lfloor\notyet{x}\rfloor`,r=convert(source,options);
 expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toContain('⠿');
 expect(r.diagnostics.filter(d=>d.code==='math-symbol-described')).toHaveLength(2);
 expect(r.diagnostics.some(d=>d.code==='math-source-transcribed')).toBe(true);
});

test.each([String.raw`\lfloor{x\rfloor}`,String.raw`{\lfloor x}\rfloor`,String.raw`\lfloor\mathbf{x\rfloor}`,String.raw`\begin{aligned}\lfloor&x\rfloor\end{aligned}`])('ordinary grouping and aligned cells do not sever the delimiter flow: %s',source=>{
 expect(convert(source,options).complete).toBe(true);
});

test.each([String.raw`\frac{\lfloor x}{y\rfloor}`,String.raw`\lfloor x^{\rfloor}`,String.raw`\lfloor\sqrt{x\rfloor}`])('separate mathematical fields cannot supply a missing delimiter: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);
 expect(r.diagnostics.some(d=>d.code==='math-unmatched-rounding-delimiter')).toBe(true);
 expect(r.unicode||r.preview?.unicode).toBeTruthy();
});

test.each([['uparrow','↑'],['downarrow','↓'],['updownarrow','↕'],['Uparrow','⇑'],['Downarrow','⇓'],['Updownarrow','⇕']])('%s retains direction and line style equivalent to %s',(command,glyph)=>{
 const source=`x\\${command} y`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(convert(`x${glyph}y`,options).unicode);
 expect(convert(source,{paragraphIndent:0}).complete).toBe(true);expect(r.document.source).toBe(source);
});

test('directions and line styles remain six distinct outputs',()=>{
 const values=['uparrow','downarrow','updownarrow','Uparrow','Downarrow','Updownarrow'].map(command=>convert(`x\\${command} y`,options).unicode);
 expect(new Set(values).size).toBe(6);
});

test('vertical arrows retain indexed limits and annotations without becoming chemical products',()=>{
 const r=convert(String.raw`\lim_{x\downarrow0}f(x)`,options);expect(r.complete).toBe(true);
 expect(r.document.source).toBe(String.raw`\lim_{x\downarrow0}f(x)`);
 const above=convert(String.raw`\overset{\uparrow}{x}`,options);expect(above.complete).toBe(true);
 expect(above.unicode.endsWith(braille(['13456','156']))).toBe(true);
});
