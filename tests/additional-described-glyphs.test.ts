import {test,expect} from 'vitest';
import {convert} from '../packages/core/src/convert';
import {encodeText} from '../packages/core/src/rules/text';
const options={mode:'math' as const,paragraphIndent:0};
test.each([['hbar','ℏ'],['triangleq','≜'],['simeq','≃'],['complement','∁']])('%s preserves its glyph identity equivalent to %s',(command,glyph)=>{
 const source=`x\\${command} y`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(convert(`x${glyph}y`,options).unicode);
 expect(convert(source,{paragraphIndent:0}).complete).toBe(true);
 expect(r.document.source).toBe(source);expect(r.metadata.chineseWords).toEqual([]);
 expect(r.atoms.every(a=>a.span.start>=0 && a.span.end<=source.length)).toBe(true);
});
test('hbar retains the explicit h spelling rather than replacing it with a value',()=>{
 const r=convert(String.raw`\hbar`,options);
 expect(r.unicode).toContain(encodeText('h',0,{mathText:true}).atoms.map(a=>a.cells).join(''));
 expect(r.unicode).not.toBe(convert('h',options).unicode);
});
test('relation glyphs remain distinct from equality, similarity and approximate equality',()=>{
 const values=['triangleq','simeq','approx','sim'].map(command=>convert(`x\\${command} y`,options).unicode);
 expect(new Set(values).size).toBe(4);expect(values).not.toContain(convert('x=y',options).unicode);
});
test.each([String.raw`E=\hbar\omega`,String.raw`\frac{\hbar}{2\pi}`,String.raw`x^{\bot}`,String.raw`\overset{\triangleq}{x}`,String.raw`\begin{aligned}\text{因为}&x\simeq y\\\text{所以}&z\triangleq w\end{aligned}`])('new glyphs retain nested and mixed-text fields: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.unicode).toBeTruthy();expect(r.document.source).toBe(source);
});
test('unresolved neighboring content remains visible',()=>{
 const r=convert(String.raw`\hbar+\notyet{x}`,options);expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toContain('⠿');
});
test('review mode does not silently assert a native hbar sign',()=>{
 const r=convert(String.raw`\hbar`,{...options,symbolPolicy:'review-unmapped'});expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toContain('⠿');
});
test('modified h remains a complete operand for postfix notation',()=>{
 const r=convert(String.raw`\hbar!`,options);expect(r.complete).toBe(true);
 expect(r.unicode).toBe(convert('ℏ!',options).unicode);
 expect(r.document.source).toBe(String.raw`\hbar!`);
});
