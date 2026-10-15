import {test,expect} from 'vitest';
import {convert} from '../packages/core/src/convert';
import {braille} from '../packages/core/src/rules/math-symbols';
const options={mode:'math' as const,paragraphIndent:0};
const pairs=[['leftarrow','←'],['Leftarrow','⇐'],['longleftarrow','⟵'],['Longleftarrow','⟸'],['leftrightharpoons','⇋'],['rightleftharpoons','⇌'],['leftharpoonup','↼'],['leftharpoondown','↽'],['rightharpoonup','⇀'],['rightharpoondown','⇁']];
test.each(pairs)('%s preserves direction and glyph identity equivalent to %s',(name,glyph)=>{
 const source=`A\\${name} B`,r=convert(source,options);expect(r.complete).toBe(true);
 expect(r.unicode).toBe(convert(`A${glyph}B`,options).unicode);expect(r.document.source).toBe(source);
 expect(convert(source,{paragraphIndent:0}).complete).toBe(true);
});
test('harpoon order and single-hook orientation stay distinct',()=>{
 const names=['leftrightharpoons','rightleftharpoons','leftharpoonup','leftharpoondown','rightharpoonup','rightharpoondown'];
 expect(new Set(names.map(name=>convert(`A\\${name} B`,options).unicode)).size).toBe(6);
});
test.each([['xleftarrow','leftarrow'],['xLeftarrow','Leftarrow'],['xleftrightharpoons','leftrightharpoons'],['xrightleftharpoons','rightleftharpoons'],['xleftharpoonup','leftharpoonup'],['xleftharpoondown','leftharpoondown'],['xrightharpoonup','rightharpoonup'],['xrightharpoondown','rightharpoondown']])('%s preserves independent upper/lower labels',(name,base)=>{
 const source=`A\\${name}[g]{f}B`,r=convert(source,options);expect(r.complete).toBe(true);
 expect(r.unicode).toBe(convert(`A\\overset{f}{\\underset{g}{\\${base}}}B`,options).unicode);
 expect(r.document.source).toBe(source);expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
});
test('a native left-arrow position mark retains its checked points',()=>{
 const r=convert(String.raw`\overset{\leftarrow}{x}`,options);expect(r.complete).toBe(true);
 expect(r.unicode).toBe(braille(['56','1346','45','246','25','156']));
});
test('unknown arrow labels remain visible',()=>{
 const source=String.raw`A\xrightleftharpoons{\unknown}B`,r=convert(source,options);
 expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toContain('⠿');expect(r.document.source).toBe(source);
});
