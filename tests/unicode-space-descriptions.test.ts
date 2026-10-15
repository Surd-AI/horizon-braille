import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {encodeText} from '../packages/core/src/rules/text';
import {UNICODE_SPACE_NAMES} from '../packages/core/src/rules/unicode-space-names';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={mode:'text' as const,paragraphIndent:0};
test.each(Object.keys(UNICODE_SPACE_NAMES))('Unicode space %s preserves name and source',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();
 expect(r.atoms.filter(a=>a.kind==='cell'&&a.ruleId==='editorial-unicode-space-name').map(a=>a.kind==='cell'?a.cells:'').join('')).toBe(encodeText(UNICODE_SPACE_NAMES[source],0).atoms.map(a=>a.cells).join(''));
 expect(r.atoms.every(a=>a.span.start===0&&a.span.end===1)).toBe(true);expect(r.diagnostics.some(d=>d.code==='text-unicode-space-described')).toBe(true);
});
test('all space names and original glyphs are distinct',()=>{expect(Object.keys(UNICODE_SPACE_NAMES)).toHaveLength(15);expect(new Set(Object.keys(UNICODE_SPACE_NAMES).map(s=>convert(s,options).unicode)).size).toBe(15);});
test.each(['\u200b','\u2060','\ufeff'])('zero-width characters are not guessed as space %s',source=>{const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();});
test.each(['\\text{a\u2003b}','\\begin{aligned}\\text{因为\u00a0所以}&x=1\\end{aligned}'])('TeX prose space is described %s',source=>{const r=convert(source,{mode:'math',paragraphIndent:0});expect(r.complete).toBe(true);expect(r.diagnostics.some(d=>d.code==='text-unicode-space-described')).toBe(true);expect(r.document.source).toBe(source);});
test('ordinary whitespace and source breaks retain existing behavior',()=>{expect(encodeText(' ',0).atoms.map(a=>a.cells).join('')).toBe('⠀');expect(encodeText('\u3000',0).atoms.map(a=>a.cells).join('')).toBe('⠀⠀');expect(convert('a\nb',options).unicode).toContain('\n');});
test('manual Chinese edits preserve the readonly space identity',()=>{const r=encodeDocument('因为\u2003所以',options),e=applyManualBraille(r,[{start:0,end:2,cells:'⠁⠃'}]);expect(r.complete).toBe(true);expect(e.atoms.filter(a=>a.ruleId.startsWith('editorial-unicode-space'))).toEqual(r.atoms.filter(a=>a.ruleId.startsWith('editorial-unicode-space')));});
