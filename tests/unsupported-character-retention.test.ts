import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {applyManualBraille} from '../packages/core/src/manual-braille';
import {encodeText} from '../packages/core/src/rules/text';
const options={mode:'text' as const,paragraphIndent:0};
test.each([['ᲀ','U+1C80'],['ﺍ','U+FE8D'],['א','U+05D0'],['😀','U+1F600'],['\u200b','U+200B'],['\u0301','U+0301'],['\uD800','UTF16+D800']])('unsupported %s retains readable exact identifier %s',(source,identifier)=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toContain('⠿');
 expect(r.diagnostics.some(d=>d.code==='text-source-character-transcribed'&&d.message.includes(identifier))).toBe(true);
 const code=r.atoms.filter(a=>a.kind==='cell'&&a.ruleId==='editorial-source-character-code').map(a=>a.kind==='cell'?a.cells:'').join('');
 expect(code).toBe(encodeText(identifier,0).atoms.map(a=>a.cells).join(''));
 expect(r.atoms.filter(a=>a.kind==='cell'&&a.ruleId.startsWith('editorial-source-character')).every(a=>a.kind==='cell'&&a.span.start===0&&a.span.end===source.length&&a.sourceRole==='structure')).toBe(true);
});
test('different unsupported characters no longer produce the same placeholder-only result',()=>{
 const values=['ᲀ','ﺍ','א','😀','🧩'].map(s=>convert(s,options).unicode);expect(new Set(values).size).toBe(values.length);
});
test('source character identifiers retain complete neighboring formula fields',()=>{
 const source=String.raw`\frac{\text{ᲀ}}{x+1}`,r=convert(source,{mode:'math',paragraphIndent:0});expect(r.complete).toBe(false);expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='text-source-character-transcribed'&&d.span.start===source.indexOf('ᲀ'))).toBe(true);
 expect(r.unhandled.some(u=>u.raw==='ᲀ')).toBe(true);
});
test('Chinese word edits cannot replace synthetic source identifiers',()=>{
 const source='因为 ᲀ',r=encodeDocument(source,options),edited=applyManualBraille(r,[{start:0,end:2,cells:'⠁⠃'}]);
 expect(edited.atoms.filter(a=>a.ruleId.startsWith('editorial-source-character'))).toEqual(r.atoms.filter(a=>a.ruleId.startsWith('editorial-source-character')));
});
test('narrow reflow retains identifiers without falsely completing unsupported text',()=>{
 const source='ᲀ ﺍ 😀',wide=convert(source,{...options,columns:200}),narrow=convert(source,{...options,columns:30});
 expect(narrow.complete).toBe(false);expect(narrow.atoms).toEqual(wide.atoms);expect(narrow.lines.length).toBeGreaterThan(1);expect(narrow.document.source).toBe(source);
});
