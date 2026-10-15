import {expect,test} from 'vitest';
import {convert} from '../packages/core/src/convert';
import {braille} from '../packages/core/src/rules/math-symbols';

// Independently transcribed points from GB/T18028-2010 §§6.3, 6.13,
// 6.16.1 and 6.17.1 (printed pages 9, 23, 30–32).
test.each([
 ['langle','5 246'],['rangle','135 2'],['vdots','46'],['ddots','15 3'],
 ['arg','1246 1'],['Re','1246 6 1235 15'],['Im','1246 6 24 134'],
 ['sinh','1246 234 125'],['cosh','1246 14 125'],['tanh','1246 2345 125'],['coth','1246 14 2345 125'],
 ['arsinh','1246 1 234 125'],['arcosh','1246 1 14 125'],['artanh','1246 1 2345 125'],['arcoth','1246 1 14 2345 125'],
 ['Ei','1246 6 15 24'],['li','1246 123 24'],['si','1246 234 24'],['Si','1246 6 234 24'],['ci','1246 14 24'],['Ci','1246 6 14 24'],
 ['am','1246 1 134'],['sn','1246 234 1345'],['cn','1246 14 1345'],['dn','1246 145 1345'],
 ['ns','1246 1345 234'],['nc','1246 1345 14'],['nd','1246 1345 145'],['sc','1246 234 14'],['sd','1246 234 145'],
 ['cs','1246 14 234'],['cd','1246 14 145'],['ds','1246 145 234'],['dc','1246 145 14'],['se','1246 234 15'],['ce','1246 14 15'],
])('checked extended command %s retains its standard cells',(name,dots)=>{
 // \ce is reserved for chemistry; an explicitly named ce function remains math.
 const r=convert(name==='ce'?String.raw`\operatorname{ce}`:`\\${name}`,{mode:'math',paragraphIndent:0});
 expect(r.complete).toBe(true);expect(r.unicode).toBe(braille(dots.split(' ')));
});

test.each([['rank','1246 1235 1 1345 13'],['Pr','1246 6 1234 1235']])('declared operator %s follows §6.16.2.2',(name,dots)=>{
 const r=convert(`\\operatorname{${name}}x`,{mode:'math',paragraphIndent:0});
 expect(r.complete).toBe(true);
 expect(r.unicode).toBe(braille([...dots.split(' '),'56','1346']));
 expect(r.document.source).toBe(`\\operatorname{${name}}x`);
});

test('an undeclared command is not guessed from the generic named-function rule',()=>{
 const r=convert('\\rank x',{mode:'math'});
 expect(r.complete).toBe(false);expect(r.unhandled.some(u=>u.raw==='\\rank')).toBe(true);
});

test('new function names keep following letters distinct from operator letters',()=>{
 const r=convert('\\tanh x',{mode:'math',paragraphIndent:0});
 expect(r.complete).toBe(true);expect(r.unicode).toBe(braille(['1246','2345','125','56','1346']));
});

test.each([['overline','45','25'],['bar','45','25'],['underline','56','25'],['widehat','45','256'],['widetilde','45','26']])('composite %s groups the annotated body by §5.4.2.3',(name,direction,mark)=>{
 const r=convert(`\\${name}{xy}`,{mode:'math',paragraphIndent:0});
 expect(r.complete).toBe(true);
 expect(r.unicode).toBe(braille(['12346','56','1346','13456','13456',direction,mark,'156']));
});

test.each([['a',['56','1','45','25','2','156']],['AB',['6','1','12','45','25','23','156']]])('vector arrow on %s follows checked §6.15 notation',(body,dots)=>{
 const r=convert(`\\vec{${body}}`,{mode:'math',paragraphIndent:0});
 expect(r.complete).toBe(true);expect(r.unicode).toBe(braille([...dots,'0']));
});

test('a long root wraps by §5.4.2.2 while its framing stays attached',()=>{
 const source=String.raw`\sqrt{abcdefghijklmnopqrstuvwxyz}`;
 const r=convert(source,{mode:'math',columns:10,paragraphIndent:0});
 expect(r.complete).toBe(true);expect(r.preview).toBeUndefined();
 expect(r.lines.length).toBeGreaterThan(1);
 expect(r.lines.every(line=>line.length<=10)).toBe(true);
 expect(r.lines[0].startsWith(braille(['146','156','56','1']))).toBe(true);
 expect(r.lines.at(-1)?.endsWith(braille(['1356','1456']))).toBe(true);
 expect(r.lines.slice(0,-1).every(line=>line.endsWith(braille(['6'])))).toBe(true);
 expect(r.document.source).toBe(source);
});
test('document detection accepts a declared operator and complete nested sized brackets',()=>{
 for(const source of [String.raw`\operatorname{rank}(x)`,String.raw`\left(\left[x\right]+y\right)`,String.raw`\widetilde{xy}`]) {
  const r=convert(source,{paragraphIndent:0});
  expect(r.complete).toBe(true);expect(r.unicode).toBe(convert(source,{mode:'math',paragraphIndent:0}).unicode);
 }
});
