import {expect,test} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {applyManualBraille} from '../packages/core/src/manual-braille';
import {braille as b} from '../packages/core/src/rules/math-symbols';
const options={mode:'math' as const,paragraphIndent:0};
test.each(['mathbb','mathfrak','mathsf','mathtt','mathboldsf','mathitsf','Bbb','frak'])('%s retains a readable font identity and complete body',name=>{
 const source=`\\${name}{A}`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.unhandled).toEqual([]);expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='math-font-described' && d.severity==='info')).toBe(true);
 expect(r.unicode.startsWith(b(['12346','4']))).toBe(true);expect(r.unicode.endsWith(b(['6','1','13456']))).toBe(true);
 expect(r.metadata.chineseWords).toEqual([]);expect(convert(source,{paragraphIndent:0}).complete).toBe(true);
});
test('mapped native fonts retain their checked signs without a description',()=>{
 expect(convert(String.raw`\mathbf{A}`,options).unicode).toBe(b(['6','12456','1']));
 expect(convert(String.raw`\mathbf{A}`,options).diagnostics.some(d=>d.code==='math-font-described')).toBe(false);
});
test('different unmapped fonts do not collapse onto an ordinary or identical styled variable',()=>{
 const variants=['A',String.raw`\mathbb{A}`,String.raw`\mathfrak{A}`,String.raw`\mathsf{A}`].map(s=>convert(s,options).unicode);
 expect(new Set(variants).size).toBe(4);
});
test.each(['mathbb','mathfrak','mathsf','mathtt'])('strict review policy still flags the absent native %s sign',name=>{
 const r=convert(`\\${name}{A}`,{...options,fontPolicy:'review-unmapped'});
 expect(r.complete).toBe(false);expect(r.unhandled).toHaveLength(1);expect(r.diagnostics.some(d=>d.code==='math-font-unverified')).toBe(true);
});
test.each([String.raw`\mathbb{}`,String.raw`\mathfrak{\unknown}`,String.raw`\textbf{\unknown}`])('unresolved/empty content is not hidden by a font description: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toContain('⠿');expect(r.document.source).toBe(source);
});
test('literal styled prose retains real word spans and editable content, not synthetic label words',()=>{
 const source=String.raw`\textbf{因为}`,r=convert(source,options),start=source.indexOf('因为');
 expect(r.complete).toBe(true);expect(r.metadata.chineseWords.filter(w=>w.kind==='chinese').map(w=>w.raw)).toEqual(['因为']);
 expect(r.metadata.chineseWords.every(w=>source.slice(w.span.start,w.span.end)===w.raw)).toBe(true);
 const encoded=encodeDocument(source,options),edited=applyManualBraille(encoded,[{start,end:start+2,cells:'⠁⠃'}]);
 const frames=(r:typeof encoded)=>r.atoms.flatMap(a=>a.kind==='cell' && a.sourceRole==='structure'?[a.cells]:[]);
 expect(frames(edited)).toEqual(frames(encoded));expect(edited.document.source).toBe(source);
});
test('literal textit whitespace survives instead of becoming juxtaposed variables',()=>{
 const r=convert(String.raw`\textit{a b}`,options);expect(r.complete).toBe(true);
 expect(r.unicode).toContain(convert(String.raw`\text{a b}`,options).unicode);
});
test.each([String.raw`\mathbb{\begin{pmatrix}a\\b\end{pmatrix}}`,String.raw`\mathsf{\begin{aligned}x&=1\\y&=2\end{aligned}}`])('font description retains the whole row scope: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.diagnostics.some(d=>d.code==='layout-conflicting-control')).toBe(false);
 expect(r.unicode.endsWith(b(['13456']))).toBe(true);
});
test('described-font numerals do not acquire a false transpose role',()=>{
 const r=convert(String.raw`\mathbb{1}^{\top}`,options);expect(r.complete).toBe(false);
 expect(r.diagnostics.some(d=>d.code==='math-transpose-normalized')).toBe(false);
});
test.each([['ℝ','mathbb','R'],['𝔄','mathfrak','A'],['𝐀','mathbf','A'],['𝑎','mathit','a'],['𝓐','mathbfscr','A'],['𝖠','mathsf','A'],['𝚊','mathtt','a']])('Unicode %s preserves its mathematical font',(glyph,font,letter)=>{
 const r=convert(glyph,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(glyph);
 if(font!=='mathbfscr')expect(r.unicode).toBe(convert(`\\${font}{${letter}}`,options).unicode);
 else expect(r.unicode).toBe(b(['6','3456','1']));
 expect(convert(glyph,{paragraphIndent:0}).unicode).toBe(r.unicode);
 expect(r.atoms.every(a=>a.span.start>=0 && a.span.end<=glyph.length)).toBe(true);
});
test('ordinary compatibility ligatures are not silently normalized as mathematical fonts',()=>{
 expect(convert('ﬀ',options).complete).toBe(false);
});
test('long described-font bodies retain all atoms across line continuation',()=>{
 const source=String.raw`\mathbb{abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz}`,wide=convert(source,{...options,columns:200}),narrow=convert(source,{...options,columns:30});
 expect(narrow.complete).toBe(true);expect(narrow.lines.length).toBeGreaterThan(1);
 expect(narrow.atoms.flatMap(a=>a.kind==='cell'?[a.cells]:[])).toEqual(wide.atoms.flatMap(a=>a.kind==='cell'?[a.cells]:[]));
});
