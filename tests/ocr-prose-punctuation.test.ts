import {expect,test} from 'vitest';
import {convert} from '../packages/core/src/convert';
import {encodeText} from '../packages/core/src/rules/text';
import {braille} from '../packages/core/src/rules/math-symbols';

test.each([[',','5'],[';','56'],[':','36'],['?','5 3'],['!','56 2'],['.','5 23'],['(','56 3'],[')','6 23']])('ASCII prose %s uses its checked punctuation cells',(source,dots)=>{
 const r=encodeText(source,7,{mathText:true});
 expect(r.complete).toBe(true);expect(r.atoms.map(a=>a.cells).join('')).toBe(braille(dots.split(' ')));
 expect(r.atoms.every(a=>a.span.start===7 && a.span.end===8)).toBe(true);
});

test('literal punctuation differs from mathematical ratio and decimal signs',()=>{
 expect(convert(String.raw`\text{:}`,{mode:'math',paragraphIndent:0}).unicode).toBe(braille(['36']));
 expect(convert('1:2',{mode:'math',paragraphIndent:0}).unicode).toContain(braille(['5','25']));
 expect(convert(String.raw`\text{1.5}`,{mode:'math',paragraphIndent:0}).unicode).toBe(braille(['4','3456','1','2','15']));
 const resolved=encodeText('：',0,{colonMeaning:()=> 'ratio'});
 expect(resolved.atoms.map(a=>a.cells).join('')).toBe(braille(['46','5','25']));
});

test('ASCII punctuation in aligned explanations preserves words and exact source spans',()=>{
 const source=String.raw`\begin{aligned}\text{因为:}&x>0\\\text{所以,}&x^2>0\end{aligned}`;
 const r=convert(source,{mode:'math',columns:30,paragraphIndent:0});
 expect(r.unhandled).toEqual([]);expect(r.document.source).toBe(source);expect(r.unicode).not.toContain('⠿');
 expect(r.metadata.chineseWords.some(w=>w.raw==='因为')).toBe(true);
 for(const character of [':',',']) {
  const index=source.indexOf(character);
  expect(r.atoms.some(a=>a.kind==='cell' && a.span.start===index && a.span.end===index+1 && a.cells===braille([character===':'?'36':'5']))).toBe(true);
 }
});
