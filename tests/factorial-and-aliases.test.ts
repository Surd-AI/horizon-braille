import {expect,test} from 'vitest';
import {convert} from '../packages/core/src/convert';
import {braille as b} from '../packages/core/src/rules/math-symbols';
const options={mode:'math' as const,paragraphIndent:0};
// Independently transcribed GB/T18028-2010 §6.10.1, printed page 22.
test('factorial uses the checked point pair after its operand',()=>{
 const r=convert('n!',options);expect(r.complete).toBe(true);expect(r.unicode).toBe(b(['56','1345','6','235']));
 expect(convert('5!!',options).unicode).toBe(b(['3456','15','6','235','6','235']));
});
test('a factorial without an operand stays explicitly unresolved',()=>{
 const r=convert('!',options);expect(r.complete).toBe(false);expect(r.diagnostics.some(d=>d.code==='math-factorial-missing-base')).toBe(true);
});
test.each(['a<!3','a\\leq !3','\\sin!'])('a prefix exclamation is not falsely accepted as factorial: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.diagnostics.some(d=>d.code==='math-factorial-missing-base')).toBe(true);expect(r.document.source).toBe(source);
});
test.each(['|S|!',String.raw`\left|S\right|!`])('a closing magnitude/cardinality bar is a valid factorial operand: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.unicode).toBe(b(['456','6','234','456','6','235']));
});
test('an opening bar does not supply a factorial operand',()=>{
 const r=convert('|!x',options);expect(r.complete).toBe(false);expect(r.diagnostics.some(d=>d.code==='math-factorial-missing-base')).toBe(true);
});
test.each(['n!','(n!)','5!!'])('document detection retains complete postfix factorial syntax: %s',source=>{
 const r=convert(source,{paragraphIndent:0});expect(r.complete).toBe(true);expect(r.unicode).toBe(convert(source,options).unicode);
});
test.each([['longrightarrow','rightarrow'],['Longrightarrow','Rightarrow'],['Longleftrightarrow','Leftrightarrow'],['tg','tan'],['ctg','cot'],['cosec','csc']])('typographic alias %s retains %s meaning',(alias,canonical)=>{
 const source=`x\\${alias} y`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(convert(`x\\${canonical} y`,options).unicode);
 expect(r.document.source).toBe(source);
});
test.each([['→','rightarrow'],['⇒','Rightarrow'],['⇔','Leftrightarrow']])('a pasted %s glyph retains the checked %s arrow',(glyph,canonical)=>{
 const source=`x${glyph}y`,r=convert(source,{paragraphIndent:0});
 expect(r.complete).toBe(true);expect(r.unicode).toBe(convert(`x\\${canonical} y`,options).unicode);
 expect(r.document.source).toBe(source);
});
test('a Unicode ellipsis has the same dots as its TeX spelling and prose needs no math marker',()=>{
 expect(convert('1…n',options).unicode).toBe(convert(String.raw`1\dots n`,options).unicode);
 expect(convert('abc… def',{mode:'text',paragraphIndent:0}).unicode).toBe(b(['56','1','12','14','5','5','5','0','56','145','15','124']));
});
// §6.9.1, printed page 20: independently listed inverse trig functions.
test.each([['arccot','1246 1 14 2345'],['arcsec','1246 1 234 14'],['arccsc','1246 1 14 234']])('inverse trig %s uses checked points',(name,dots)=>{
 const r=convert(`\\${name} x`,options);expect(r.complete).toBe(true);expect(r.unicode).toBe(b([...dots.split(' '),'56','1346']));
});
test('ellipsis spelling and following-word spacing follow §5.4.2.1',()=>{
 const r=convert(String.raw`1\dots n`,options);expect(r.complete).toBe(true);expect(r.unicode).toBe(b(['3456','1','5','5','5','0','56','1345']));
 expect(convert(String.raw`a,\dots,b`,options).unicode).toBe(convert(String.raw`a,\ldots,b`,options).unicode);
 expect(convert(String.raw`1\dots+n`,options).unicode).toBe(b(['3456','1','5','5','5','0','235','56','1345']));
 expect(convert(String.raw`1\mathrm{\dots}n`,options).unicode).toContain(b(['5','5','5','0']));
});
