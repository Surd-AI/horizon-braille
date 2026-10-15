import {expect,test} from 'vitest';
import {convert} from '../packages/core/src/convert';
import {braille as b} from '../packages/core/src/rules/math-symbols';
const options={mode:'math' as const,paragraphIndent:0};
// GB/T18028-2010 §6.2.1 items 3–4,7–10 and §6.2.2.1, printed pp8–9.
test.each([['ngtr','≯','4 135'],['nless','≮','4 246'],['gtrless','≷','135 246'],['lessgtr','≶','246 135'],['gg','≫','135 135'],['ll','≪','246 246']])('%s has its own checked cells and both-side spacing',(name,glyph,dots)=>{
 const r=convert(`a\\${name} b`,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(b(['56','1','0',...dots.split(' '),'0','56','12']));
 expect(convert(`a${glyph}b`,options).unicode).toBe(r.unicode);
 expect(convert(`a\\${name} b`,{paragraphIndent:0}).unicode).toBe(r.unicode);
});
test.each([['>','ngtr'],['<','nless']])('explicit negation of %s preserves its checked negative glyph',(glyph,name)=>{
 expect(convert(`a\\not ${glyph}b`,options).unicode).toBe(convert(`a\\${name} b`,options).unicode);
 expect(convert(`a\\not ${glyph}b`,options).complete).toBe(true);
});
test('unchecked negation is still unresolved',()=>{
 const r=convert(String.raw`a\not\ll b`,options);expect(r.complete).toBe(false);expect(r.unicode).toContain('⠿');
});
test.each([['gt','>','ngtr'],['lt','<','nless']])('%s retains its relation and checked negation',(name,glyph,negative)=>{
 expect(convert(`a\\${name} b`,options).unicode).toBe(convert(`a${glyph}b`,options).unicode);
 expect(convert(`a\\not\\${name} b`,options).unicode).toBe(convert(`a\\${negative} b`,options).unicode);
 expect(convert(`a\\${name} b`,{paragraphIndent:0}).complete).toBe(true);
});
// GB §6.5.1 items 16–18 (printed p14), with direction and explicit ending.
test.each([['check','45','56 35'],['breve','45','26 35'],['overparen','45','35 26'],['underparen','56','26 35']])('%s retains its position glyph and scope',(name,direction,dots)=>{
 const source=`\\${name}{x}`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(b(['56','1346',direction,...dots.split(' '),'156']));
 expect(convert(source,{paragraphIndent:0}).unicode).toBe(r.unicode);
 const compound=convert(`\\${name}{a+b}`,options);
 expect(compound.complete).toBe(true);expect(compound.unicode).toBe(b(['12346','56','1','0','235','56','12','13456',direction,...dots.split(' '),'156']));
});
test('arcs above and below retain separate direction and ending cells',()=>{
 const r=convert(String.raw`\overparen{\underparen{x}}`,options);expect(r.complete).toBe(true);
 expect(r.unicode.endsWith(b(['56','26','35','156','13456','45','35','26','156']))).toBe(true);
});
test.each([String.raw`\check{}`,String.raw`\breve{\unknown}`,String.raw`\hat{}`,String.raw`\overline{}`,String.raw`\underline{}`,String.raw`\dot{}`,String.raw`\vec{}`])('empty or unknown accent content remains visible: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toContain('⠿');expect(r.document.source).toBe(source);
});
