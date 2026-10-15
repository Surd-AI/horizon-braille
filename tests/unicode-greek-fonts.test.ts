import {expect,test} from 'vitest';
import {convert} from '../packages/core/src/convert';
import {MATHEMATICAL_LETTERS} from '../packages/core/src/rules/math-alphabet';
import {braille as b} from '../packages/core/src/rules/math-symbols';
const options={mode:'math' as const,paragraphIndent:0};
const families:readonly [number,string][]=[[0x1d6a8,'mathbf'],[0x1d6e2,'mathit'],[0x1d71c,'boldsymbol'],[0x1d756,'mathboldsf'],[0x1d790,'mathbolditsf']];
const capitals=Array.from('ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ'),small=Array.from('αβγδεζηθικλμνξοπρστυφχψω');
const cases=families.flatMap(([start,font])=>[0,26].flatMap(offset=>Array.from({length:25},(_,index)=>({index,glyph:String.fromCodePoint(start+offset+index),letter:(offset?small:capitals)[index<17?index:index-1],font})).filter(c=>c.index!==17)));
test.each(cases)('$font Greek $glyph retains its case, identity and source span',({glyph,letter,font})=>{
 expect(MATHEMATICAL_LETTERS[glyph]).toEqual({letter,font});
 const r=convert(glyph,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(glyph);
 expect(r.atoms.every(a=>a.span.start>=0 && a.span.end<=2)).toBe(true);
 expect(convert(glyph,{paragraphIndent:0}).unicode).toBe(r.unicode);
 if(font!=='mathbolditsf')expect(r.unicode).toBe(convert(`\\${font}{${letter}}`,options).unicode);
 else expect(r.diagnostics.some(d=>d.code==='math-font-described')).toBe(true);
});
test('bold Greek alpha uses the independently checked case/font/letter order',()=>{
 expect(convert(String.fromCodePoint(0x1d6a8),options).unicode).toBe(b(['456','12456','1']));
 expect(convert(String.fromCodePoint(0x1d6c2),options).unicode).toBe(b(['46','12456','1']));
});
test.each(families)('%s retains variant glyphs as unresolved instead of flattening them',(start)=>{
 for(const offset of [17,43,52,53,54,55,56,57]) {
  const glyph=String.fromCodePoint(start+offset),r=convert(glyph,options);
  expect(MATHEMATICAL_LETTERS[glyph]).toBeUndefined();expect(r.complete).toBe(false);
  expect(r.document.source).toBe(glyph);expect(r.unicode||r.preview?.unicode).toContain('⠿');
 }
});
test.each([[0x1d6d7,'varphi'],[0x1d6d2,'varrho'],[0x1d6c9,'vartheta'],[0x1d6d1,'varpi']])('styled canonical %s retains distinct declared variant identity',(point,name)=>{
 const source=String.fromCodePoint(point)+`+\\boldsymbol{\\${name}}`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='math-greek-variant-described')).toBe(true);
});
test('scripted Greek keeps exact two-code-unit offsets',()=>{
 const glyph=String.fromCodePoint(0x1d6c2),source=glyph+'_1^2',r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.unicode).toBe(convert(String.raw`\mathbf{\alpha}_1^2`,options).unicode);
});
