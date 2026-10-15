import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {encodeText} from '../packages/core/src/rules/text';
import {CYRILLIC_LETTER_NAMES} from '../packages/core/src/rules/cyrillic-letter-names';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={mode:'text' as const,paragraphIndent:0};
test.each(Object.keys(CYRILLIC_LETTER_NAMES))('Cyrillic letter %s retains name, case and source',source=>{
 const r=convert(source,options),name=CYRILLIC_LETTER_NAMES[source].name;
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.atoms.filter(a=>a.kind==='cell'&&a.ruleId==='editorial-cyrillic-letter-name').map(a=>a.kind==='cell'?a.cells:'').join('')).toBe(encodeText(name,0).atoms.map(a=>a.cells).join(''));
 expect(r.diagnostics.some(d=>d.code==='text-cyrillic-letter-described')).toBe(true);
 expect(r.atoms.every(a=>a.span.start===0&&a.span.end===source.length)).toBe(true);
});
test('lookalike letters retain alphabet, case and spelling distinctions',()=>{
 expect(new Set(['A','А','а','Я','я','Й','И','Ё','Е','Ґ','Г','Ӏ','ӏ'].map(s=>convert(s,options).unicode)).size).toBe(13);
 expect(Object.keys(CYRILLIC_LETTER_NAMES)).toHaveLength(248);
 expect(new Set(Object.values(CYRILLIC_LETTER_NAMES).map(n=>`${n.upper}:${n.ligature}:${n.name}`)).size).toBe(248);
 expect(['А','а','Я','я','Й','И','Ё','Е','Ґ','Г','Ӏ','ӏ'].every(s=>convert(s,options).complete)).toBe(true);
});
test.each([String.raw`\text{Привет}`,String.raw`\frac{Ж}{я}`,String.raw`\begin{aligned}\text{因为}&Ж+я=1\\\text{所以}&x=2\end{aligned}`])('formula literal and aligned fields preserve Cyrillic identity: %s',source=>{
 const r=convert(source,{mode:'math',paragraphIndent:0});expect(r.complete).toBe(true);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();
 expect(r.diagnostics.some(d=>d.code==='text-cyrillic-letter-described')).toBe(true);
});
test.each([String.raw`\text{Привет}`,String.raw`$\frac{Ж}{я}$`])('document detection retains declared Cyrillic fields: %s',source=>{
 const r=convert(source,{mode:'document',paragraphIndent:0});expect(r.complete).toBe(true);expect(r.document.source).toBe(source);expect(r.document.nodes.some(n=>n.kind==='bare-math'||n.kind==='inline-math')).toBe(true);
});
test.each(['҂','҃','҉','ᲀ','а\u0301'])('unlisted marks or outside-block letters remain source-bound for review: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
test('Chinese word edits preserve neighboring Cyrillic captions',()=>{
 const r=encodeDocument('因为 Жя',options),edit=applyManualBraille(r,[{start:0,end:2,cells:'⠁⠃'}]);expect(r.complete).toBe(true);
 expect(edit.atoms.filter(a=>a.ruleId.startsWith('editorial-cyrillic'))).toEqual(r.atoms.filter(a=>a.ruleId.startsWith('editorial-cyrillic')));
});
test('long names reflow without losing the glyph or its readable identity',()=>{
 const source='Ӝ ӹ Ҥ',r=convert(source,{...options,columns:30});expect(r.complete,JSON.stringify(r.diagnostics)).toBe(true);expect(r.document.source).toBe(source);expect(r.lines.length).toBeGreaterThan(1);expect(r.lines.every(l=>l.length<=30)).toBe(true);
});
