import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {latinDiacritics} from '../packages/core/src/rules/latin-diacritics';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={mode:'text' as const,paragraphIndent:0};
test.each(['é','É','ó','á','à','í','ñ','ç','ü','ā','ă','č','ů','ő','ǫ','ọ','ợ','ấ'])('Latin glyph %s retains base case and every supported mark',source=>{
 const decomposition=latinDiacritics(source),r=convert(source,options);expect(decomposition).toBeTruthy();expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.diagnostics.filter(d=>d.code==='text-latin-described')).toHaveLength(1);
 expect(r.atoms.filter(a=>a.kind==='cell').every(a=>a.span.start===0&&a.span.end===source.length)).toBe(true);
 expect(r.metadata.chineseWords.some(w=>w.kind==='chinese')).toBe(false);
});
test('case, base and mark differences remain distinct',()=>{
 const values=['é','É','e','è','ê','ë','ó'].map(s=>convert(s,options).unicode);expect(new Set(values).size).toBe(values.length);
 expect(latinDiacritics('ợ')).toEqual({base:'o',marks:['\u031b','\u0323']});
});
test.each(['æ','ø','ß','đ','α','о','²','Ａ','\u0301'])('unsupported or compatibility glyph %s is not flattened',source=>{
 expect(latinDiacritics(source)).toBeUndefined();const r=convert(source,options);expect(r.document.source).toBe(source);
});
test('unknown script beside a supported Latin glyph remains pending',()=>{
 const source='éᲀ',r=convert(source,options);expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toContain('⠿');expect(r.document.source).toBe(source);
});
test('math text glyph descriptions preserve formula fields',()=>{
 const source=String.raw`\frac{\text{café}}{\text{á}}`,r=convert(source,{mode:'math',paragraphIndent:0});expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='text-latin-described')).toBe(true);
});
test.each([String.raw`\text{café}`,String.raw`\mbox{é}`,String.raw`\frac{\text{é}}{\text{ấ}}`])('document mode retains declared accented text: %s',source=>{
 const r=convert(source,{mode:'document',paragraphIndent:0});expect(r.complete).toBe(true);expect(r.document.source).toBe(source);expect(r.diagnostics.some(d=>d.code==='text-latin-described')).toBe(true);
});
test('Chinese word edits retain neighboring foreign glyph descriptions',()=>{
 const source='因为 é',r=encodeDocument(source,options),edited=applyManualBraille(r,[{start:0,end:2,cells:'⠁⠃'}]);expect(r.complete).toBe(true);
 expect(edited.atoms.filter(a=>a.ruleId==='editorial-latin-description')).toEqual(r.atoms.filter(a=>a.ruleId==='editorial-latin-description'));
});
test('multiple marks remain present at narrow layout widths',()=>{
 const source='ấ é ọ',r=convert(source,{...options,columns:30});expect(r.complete).toBe(true);expect(r.lines.length).toBeGreaterThan(1);expect(r.document.source).toBe(source);
});
