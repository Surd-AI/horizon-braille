import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {encodeText} from '../packages/core/src/rules/text';
import {LATIN_LETTER_NAMES} from '../packages/core/src/rules/latin-letter-names';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={mode:'text' as const,paragraphIndent:0};
test.each(Object.keys(LATIN_LETTER_NAMES))('Latin %s retains identity and source',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.atoms.filter(a=>a.kind==='cell'&&a.ruleId==='editorial-latin-identity-letter-name').map(a=>a.kind==='cell'?a.cells:'').join('')).toBe(encodeText(LATIN_LETTER_NAMES[source].name,0).atoms.map(a=>a.cells).join(''));
 expect(r.atoms.every(a=>a.span.start===0&&a.span.end===source.length)).toBe(true);
});
test('glyph identities remain distinct',()=>{expect(Object.keys(LATIN_LETTER_NAMES)).toHaveLength(33);expect(new Set(['d','D','đ','Đ','i','j','ı','ȷ','h','ħ','Ø','ø','o'].map(s=>convert(s,options).unicode)).size).toBe(13);});
test.each([String.raw`\text{đıȷ}`,String.raw`\frac{đ}{ı}`,String.raw`\imath+\jmath`,String.raw`\begin{aligned}\text{因为}&\imath+đ=1\\\text{所以}&x=2\end{aligned}`])('math identity %s',source=>{const r=convert(source,{mode:'math',paragraphIndent:0});expect(r.complete).toBe(true);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();});
test.each([String.raw`\text{đıȷ}`,String.raw`\imath+\jmath`])('document identity %s',source=>{const r=convert(source,{mode:'document',paragraphIndent:0});expect(r.complete).toBe(true);expect(r.document.nodes.some(n=>n.kind==='bare-math')).toBe(true);});
test.each([['imath','ı'],['jmath','ȷ']])('control %s retains command span',(command,glyph)=>{const source='\\'+command,r=convert(source,{mode:'math',paragraphIndent:0});expect(r.complete).toBe(true);expect(r.unicode).toBe(convert(glyph,{mode:'math',paragraphIndent:0}).unicode);expect(r.atoms.every(a=>a.span.start===0&&a.span.end===source.length)).toBe(true);});
test.each(['Æ','ŋ','đ\u0301',String.raw`\imathunknown{a}`])('unknown stays visible %s',source=>{const r=convert(source,{mode:source.startsWith('\\')?'math':'text',paragraphIndent:0});expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();});
test('manual edits retain descriptions',()=>{const r=encodeDocument('因为 đıȷ',options),e=applyManualBraille(r,[{start:0,end:2,cells:'⠁⠃'}]);expect(r.complete).toBe(true);expect(e.atoms.filter(a=>a.ruleId.startsWith('editorial-latin-identity'))).toEqual(r.atoms.filter(a=>a.ruleId.startsWith('editorial-latin-identity')));});
