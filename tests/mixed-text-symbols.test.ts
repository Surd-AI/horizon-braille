import {expect,test} from 'vitest';
import {convert} from '../packages/core/src/convert';
import {parseDocument} from '../packages/core/src/parser/document';
import {encodeText} from '../packages/core/src/rules/text';
import {braille as b} from '../packages/core/src/rules/math-symbols';

test.each([String.raw`$1-p = \frac{1}{3}$`,String.raw`$25^{\circ}$`,String.raw`$7.3\text{m}$`,String.raw`$22,000 = a \cdot 10^{-\alpha}$`])('explicit numeric TeX is not guessed as dollar currency: %s',source=>{
 expect(parseDocument(source).diagnostics.some(d=>d.code==='ambiguous-dollar-number')).toBe(false);
 expect(convert(source,{paragraphIndent:0}).complete).toBe(true);
});
test.each(['$20 dollars$','$20 is expensive'])('genuinely ambiguous currency prose remains diagnosed: %s',source=>{
 expect(parseDocument(source).diagnostics.some(d=>d.code==='ambiguous-dollar-number')).toBe(true);
});
test('a slash in literal mathematical prose keeps its math marker and spacing by §5.4.2.4',()=>{
 const source=String.raw`\text{S/m}`;
 const r=convert(source,{mode:'math',paragraphIndent:0});
 expect(r.complete).toBe(true);
 expect(r.unicode).toBe(b(['4','6','234','0','46','6','1256','0','4','56','134']));
 expect(r.document.source).toBe(source);
});
test('word markers are not confused with math-symbol markers when spacing prose',()=>{
 const r=encodeText('abc def',0,{mathText:true});
 expect(r.atoms.map(a=>a.cells).join('')).toBe(b(['4','56','1','12','14','0','4','56','145','15','124']));
});
test('a literal Greek variable embedded in prose retains its letter identity',()=>{
 const r=convert(String.raw`\text{β}`,{mode:'math',paragraphIndent:0});
 expect(r.complete).toBe(true);expect(r.unicode).toBe(b(['46','46','12']));
});
test('a literal Greek word is kept together instead of becoming spaced single-letter formulas',()=>{
 const r=convert(String.raw`\text{αβγ}`,{mode:'math',paragraphIndent:0});
 expect(r.complete).toBe(true);expect(r.unicode).toBe(b(['4','46','1','12','1245']));
});
test.each([['【','56 23'],['】','56 23'],['—','6 36'],['．','5 23']])('OCR prose punctuation %s preserves its checked meaning',(source,dots)=>{
 const r=encodeText(source);
 expect(r.complete).toBe(true);expect(r.atoms.map(a=>a.cells).join('')).toBe(b(dots.split(' ')));
 expect(r.atoms.every(a=>a.span.start===0 && a.span.end===source.length)).toBe(true);
});
test('a fullwidth OCR decimal point remains a decimal, while an item period is punctuation',()=>{
 const number=encodeText('1．5');
 expect(number.complete).toBe(true);expect(number.atoms.map(a=>a.cells).join('')).toBe(b(['3456','1','2','15']));
 expect(encodeText('1．').atoms.map(a=>a.cells).join('')).toBe(b(['3456','1','5','23']));
});
test('an OCR square-bracketed prose label remains separated from its following value',()=>{
 const r=encodeText('【abc】def');
 expect(r.complete).toBe(true);
 expect(r.atoms.map(a=>a.cells).join('')).toBe(b(['56','23','56','1','12','14','56','23','0','56','145','15','124']));
});
test('straight double quotes keep opening and closing spacing around prose',()=>{
 const r=encodeText('"abc" def');
 expect(r.complete).toBe(true);
 expect(r.atoms.map(a=>a.cells).join('')).toBe(b(['45','56','1','12','14','45','0','56','145','15','124']));
});
test('straight quotation direction survives a formula between prose segments',()=>{
 const r=convert('"abc $x$ def" ghi',{paragraphIndent:0});
 expect(r.complete).toBe(true);
 const closingIndex=r.document.source.indexOf('"',1);
 const quote=r.atoms.findIndex(a=>a.kind==='cell' && a.span.start===closingIndex && a.cells===b(['45']));
 expect(quote).toBeGreaterThan(0);
 const previous=r.atoms[quote-1],next=r.atoms[quote+1];
 expect(previous.kind==='cell' && previous.cells.endsWith(b(['124']))).toBe(true);
 expect(next.kind==='cell' && next.cells===b(['0'])).toBe(true);
});
