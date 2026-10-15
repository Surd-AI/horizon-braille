import {expect,test} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {applyManualBraille} from '../packages/core/src/manual-braille';
import {braille as b} from '../packages/core/src/rules/math-symbols';
const options={mode:'math' as const,paragraphIndent:0};
// GB/T18028-2010 §6.5.2.6, printed p15: independently read bracket
// direction/body and centered-label cells, not a suffix on the last variable.
test('underbracket with count matches the checked whole-expression example',()=>{
 const r=convert(String.raw`\underbracket{A+A+\cdots+A}_{n}`,options);
 expect(r.complete).toBe(true);
 expect(r.unicode).toBe(b(['56','12356','6','1','0','235','6','1','0','235','5','5','5','0','235','6','1','23456','46','16','56','1345','156']));
});
test.each([['underbrace','56','246','135'],['overbrace','45','246','135'],['underbracket','56','12356','23456'],['overbracket','45','12356','23456']])('%s keeps the bracket around its body',(name,direction,open,close)=>{
 const source=`\\${name}{x}`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(b([direction,open,'56','1346',close]));
 expect(convert(source,{paragraphIndent:0}).unicode).toBe(r.unicode);
});
test.each([['underbrace','_','56','16'],['overbrace','^','45','34']])('%s uses a centered label in its own direction',(name,script,direction,index)=>{
 const r=convert(`\\${name}{x}${script}{n}`,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(b([direction,'246','56','1346','135','46',index,'56','1345','156']));
});
test('a numeric count keeps lower-position digits and its explicit ending',()=>{
 expect(convert(String.raw`\underbrace{x}_{12}`,options).unicode).toBe(b(['56','246','56','1346','135','46','16','2','23','156']));
});
test('an opposite-direction power remains an ordinary script',()=>{
 const r=convert(String.raw`\underbrace{x}^{n}`,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(b(['56','246','56','1346','135','34','56','1345','156']));
});
test('a prime used as an upper brace label is centered rather than a derivative',()=>{
 const r=convert(String.raw`\overbrace{x}^{\prime}`,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(b(['45','246','56','1346','135','46','34','35','156']));
});
test('nested bracket annotations retain separate scopes and labels',()=>{
 const source=String.raw`\overbrace{\underbrace{x+y}_{m}+z}^{n}`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.unicode.startsWith(b(['45','246','56','246']))).toBe(true);
 expect(r.unicode).toContain(b(['46','16','56','134','156']));
 expect(r.unicode.endsWith(b(['46','34','56','1345','156']))).toBe(true);
});
test.each([String.raw`\underbrace{}_{n}`,String.raw`\underbrace{x}_{}`,String.raw`\overbrace{x}^{\unknown}`,String.raw`\underbrace{\unknown}_{n}`,String.raw`\underbrace{x}_{\mathsf{n}}`])('incomplete body/label stays visible: %s',source=>{
 const r=convert(source,{...options,fontPolicy:'review-unmapped'});expect(r.complete).toBe(false);expect(r.document.source).toBe(source);
 expect(r.unicode||r.preview?.unicode).toContain('⠿');
});
test('Chinese labels retain exact word offsets and editable cells',()=>{
 const source=String.raw`\underbrace{x+x}_{\text{函数}}`,r=convert(source,options),start=source.indexOf('函数');
 expect(r.complete).toBe(true);expect(r.metadata.chineseWords.some(w=>w.raw==='函数' && w.span.start===start)).toBe(true);
 const encoded=encodeDocument(source,options),edited=applyManualBraille(encoded,[{start,end:start+2,cells:'⠁⠃'}]);
 const frames=(r:typeof encoded)=>r.atoms.flatMap(a=>a.kind==='cell' && a.sourceRole==='structure'?[a.cells]:[]);
 expect(frames(edited)).toEqual(frames(encoded));expect(edited.document.source).toBe(source);
});
test('long bracket bodies and labels retain identical cells across wrapping',()=>{
 const long='abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz',source=`\\overbrace{${long}}^{${long}}`;
 const wide=convert(source,{...options,columns:200}),narrow=convert(source,{...options,columns:30});
 expect(narrow.complete).toBe(true);expect(narrow.lines.length).toBeGreaterThan(1);
 expect(narrow.atoms.flatMap(a=>a.kind==='cell'?[a.cells]:[])).toEqual(wide.atoms.flatMap(a=>a.kind==='cell'?[a.cells]:[]));
 expect(narrow.lines.every(l=>l.length<=30)).toBe(true);
});
