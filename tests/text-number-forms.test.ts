import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {TEXT_NUMBER_FORMS} from '../packages/core/src/rules/text-number-forms';
import {encodeText} from '../packages/core/src/rules/text';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={mode:'text' as const,paragraphIndent:0};
test.each(Object.keys(TEXT_NUMBER_FORMS))('explicit numeral glyph %s retains its value and source identity',source=>{
 const r=convert(source,options),form=TEXT_NUMBER_FORMS[source];expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 const cells=r.atoms.filter(a=>a.kind==='cell'&&a.ruleId==='editorial-number-form-value').map(a=>a.kind==='cell'?a.cells:'').join('');expect(cells).toBe(encodeText(form.value,0).atoms.map(a=>a.cells).join(''));
 expect(r.diagnostics.some(d=>d.code==='text-number-form-described')).toBe(true);expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
});
test('Roman case, value and archaic form remain distinct from plain Latin',()=>{
 const values=['Ⅰ','Ⅱ','ⅰ','I','Ⅿ','ↀ'].map(s=>convert(s,options).unicode);expect(new Set(values).size).toBe(values.length);
 expect(TEXT_NUMBER_FORMS['Ⅻ'].value).toBe('12');expect(TEXT_NUMBER_FORMS['ↈ'].value).toBe('100000');expect(TEXT_NUMBER_FORMS['ↀ'].spelling).toBe('U+2180');
});
test('script digit positions remain distinct and do not alter ordinary digits',()=>{
 expect(new Set(['2','²','₂'].map(s=>convert(s,options).unicode)).size).toBe(3);
 expect(convert('H₂O',options).complete).toBe(true);
});
test.each(['Ↄ','ↄ','½','ⁿ','ₐ'])('unverified nearby numeric/letter form %s is not flattened',source=>{
 expect(TEXT_NUMBER_FORMS[source]).toBeUndefined();expect(convert(source,options).document.source).toBe(source);
});
test('ordinary mathematical Unicode scripts keep their native profile',()=>{
 expect(convert('x²',{mode:'math',paragraphIndent:0}).unicode).toBe(convert(String.raw`x^2`,{mode:'math',paragraphIndent:0}).unicode);
 expect(convert('x₂',{mode:'math',paragraphIndent:0}).unicode).toBe(convert(String.raw`x_2`,{mode:'math',paragraphIndent:0}).unicode);
});
test.each([String.raw`\text{H₂O}`,String.raw`\frac{Ⅰ}{Ⅱ}`,String.raw`\begin{aligned}\text{因为}&Ⅰ+Ⅱ=Ⅲ\\\text{所以}&x=1\end{aligned}`])('literal numeric glyphs retain formula fields: %s',source=>{
 const r=convert(source,{mode:'math',paragraphIndent:0});expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
});
test('Chinese edits do not change neighboring numeral descriptions',()=>{
 const source='因为 Ⅱ H₂O',r=encodeDocument(source,options),edited=applyManualBraille(r,[{start:0,end:2,cells:'⠁⠃'}]);expect(r.complete).toBe(true);
 expect(edited.atoms.filter(a=>a.ruleId.startsWith('editorial-number-form'))).toEqual(r.atoms.filter(a=>a.ruleId.startsWith('editorial-number-form')));
});
test('narrow reflow retains Roman value and spelling descriptions',()=>{
 const source='Ⅻ ↈ ⅱ',wide=convert(source,{...options,columns:200}),narrow=convert(source,{...options,columns:30});expect(narrow.complete).toBe(true);expect(narrow.atoms).toEqual(wide.atoms);expect(narrow.lines.length).toBeGreaterThan(1);
});
