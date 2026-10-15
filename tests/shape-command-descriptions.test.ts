import {test,expect} from 'vitest';
import {convert} from '../packages/core/src/convert';
const options={mode:'math' as const,paragraphIndent:0};
const pairs=[['checkmark','✓'],['bigcirc','◯'],['bigstar','★'],['diamond','⋄'],['Diamond','◊'],['lozenge','◊'],['triangledown','▽'],['triangleleft','◃'],['triangleright','▹'],['blacktriangle','▲'],['blacktriangledown','▼'],['blacktriangleleft','◀'],['blacktriangleright','▶'],['blacksquare','■']];
test.each(pairs)('%s and %s preserve matching glyph identity',(name,glyph)=>{
 const source=`a\\${name} b`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(convert(`a${glyph}b`,options).unicode);
 expect(r.document.source).toBe(source);expect(r.metadata.chineseWords).toEqual([]);
 expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
 expect(convert(source,{paragraphIndent:0}).complete).toBe(true);
 expect(convert(source,{...options,symbolPolicy:'review-unmapped'}).complete).toBe(false);
});
test('size, fill and orientation remain distinguishable',()=>{
 const names=pairs.map(p=>p[0]).filter(n=>n!=='Diamond').concat('bigtriangledown','vartriangle');
 expect(new Set(names.map(n=>convert(`a\\${n} b`,options).unicode)).size).toBe(names.length);
 expect(convert('a○b',options).unicode).not.toBe(convert('a◯b',options).unicode);
 expect(convert('a\\bigstar b',options).unicode).not.toBe(convert('a*b',options).unicode);
 expect(convert('a✔b',options).complete).toBe(false);
 expect(convert('a▵b',options).complete).toBe(false);
 expect(convert('a\\vartriangle b',options).complete).toBe(true);
});
test.each([String.raw`\frac{a\diamond b}{c\bigcirc d}`,String.raw`x^{\checkmark}`,String.raw`\begin{aligned}\text{因为}&a\triangleright b\\\text{所以}&c\blacktriangleleft d\end{aligned}`])('shape glyphs preserve compound fields and prose: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 for(const w of r.metadata.chineseWords)expect(source.slice(w.span.start,w.span.end)).toBe(w.raw);
});
test('unknown operands remain visible rather than being certified by their neighboring glyph',()=>{
 const source=String.raw`a\diamond\unknown{b}+c`,r=convert(source,options);
 expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toContain('⠿');
 expect(r.atoms.some(a=>a.ruleId==='unhandled-source-transcription')).toBe(true);
 expect(r.document.source).toBe(source);
});
