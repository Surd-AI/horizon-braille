import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {encodeText} from '../packages/core/src/rules/text';
import {ARABIC_CHARACTER_NAMES} from '../packages/core/src/rules/arabic-character-names';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={mode:'text' as const,paragraphIndent:0};
test.each(Object.keys(ARABIC_CHARACTER_NAMES))('Arabic %s retains official name and source',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.atoms.filter(a=>a.kind==='cell'&&a.ruleId==='editorial-arabic-character-name').map(a=>a.kind==='cell'?a.cells:'').join('')).toBe(encodeText(ARABIC_CHARACTER_NAMES[source].name,0).atoms.map(a=>a.cells).join(''));
 expect(r.atoms.every(a=>a.span.start===0&&a.span.end===source.length)).toBe(true);expect(r.diagnostics.some(d=>d.code==='text-arabic-character-described')).toBe(true);
});
test('letter, mark and modifier categories preserve distinct identities',()=>{
 expect(Object.keys(ARABIC_CHARACTER_NAMES)).toHaveLength(205);expect(Object.values(ARABIC_CHARACTER_NAMES).filter(f=>f.kind==='letter')).toHaveLength(150);expect(Object.values(ARABIC_CHARACTER_NAMES).filter(f=>f.kind==='mark')).toHaveLength(52);expect(Object.values(ARABIC_CHARACTER_NAMES).filter(f=>f.kind==='modifier')).toHaveLength(3);
 expect(new Set(['ا','أ','إ','آ','ء','ب','ت','ث','ـ','و','ۥ'].map(s=>convert(s,options).unicode)).size).toBe(11);
});
test.each(['بَت','ا\u0654','أ','ب\u0651\u064e'])('source order and decomposed marks remain explicit %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 const names=r.atoms.filter(a=>a.kind==='cell'&&a.ruleId==='editorial-arabic-character-name');expect(names.map(a=>a.span.start)).toEqual([...names.map(a=>a.span.start)].sort((a,b)=>a-b));
 for(let i=0;i<source.length;i++)expect(names.some(a=>a.span.start===i&&a.span.end===i+1)).toBe(true);
});
test.each([String.raw`\text{بَت}`,String.raw`\frac{أ}{ب}`,String.raw`\begin{aligned}\text{因为}&أ+ب=1\\\text{所以}&x=2\end{aligned}`])('math fields preserve Arabic identity %s',source=>{const r=convert(source,{mode:'math',paragraphIndent:0});expect(r.complete).toBe(true);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();});
test('document detects declared Arabic prose',()=>{const r=convert(String.raw`\text{بَت}`,{mode:'document',paragraphIndent:0});expect(r.complete).toBe(true);expect(r.document.nodes.some(n=>n.kind==='bare-math')).toBe(true);});
test.each(['\u0600','\u061c','\ufefb','\u0750','١',String.raw`\arabicunknown{ب}`])('out of profile or unknown controls remain visible %s',source=>{const r=convert(source,{mode:source.startsWith('\\')?'math':'text',paragraphIndent:0});expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();});
test('Chinese manual edits preserve neighboring Arabic identities',()=>{const r=encodeDocument('因为 بَت',options),e=applyManualBraille(r,[{start:0,end:2,cells:'⠁⠃'}]);expect(r.complete).toBe(true);expect(e.atoms.filter(a=>a.ruleId.startsWith('editorial-arabic'))).toEqual(r.atoms.filter(a=>a.ruleId.startsWith('editorial-arabic')));});
