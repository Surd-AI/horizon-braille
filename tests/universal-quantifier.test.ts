import {expect,test} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {applyManualBraille} from '../packages/core/src/manual-braille';
import {braille as b} from '../packages/core/src/rules/math-symbols';
const options={mode:'math' as const,paragraphIndent:0};
test('forall retains an explicit readable universal-quantifier identity',()=>{
 const r=convert(String.raw`\forall x`,options);
 expect(r.complete).toBe(true);expect(r.unhandled).toEqual([]);
 expect(r.unicode.endsWith(b(['13456','0','46','56','1346']))).toBe(true);
 expect(r.diagnostics.some(d=>d.code==='math-symbol-described' && d.severity==='info')).toBe(true);
 expect(r.metadata.chineseWords).toEqual([]);
});
test.each([String.raw`\forall x`,String.raw`\forall x\in\mathbb{R},x^2\ge0`,String.raw`\forall x\forall y,P(x,y)`,String.raw`\forall x\exists y,y>x`])('quantifier variables and predicates stay in their original scope: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(convert(source.replaceAll('\\forall','∀'),options).unicode).toBe(r.unicode);
 expect(convert(source,{paragraphIndent:0}).complete).toBe(true);
 expect(r.atoms.every(a=>a.span.start>=0 && a.span.end<=source.length)).toBe(true);
});
test('a standalone symbol has no invented bound variable or trailing mathematical entry',()=>{
 const r=convert('∀',options);expect(r.complete).toBe(true);expect(r.unicode.endsWith(b(['13456']))).toBe(true);
});
test('review mode leaves the absent native point sign unresolved',()=>{
 const r=convert(String.raw`\forall x`,{...options,symbolPolicy:'review-unmapped'});
 expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toContain('⠿');
 expect(r.diagnostics.some(d=>d.code==='math-symbol-described')).toBe(false);
});
test('quantifier descriptions preserve neighboring literal word edits',()=>{
 const source=String.raw`\forall x\in\mathbb{R},\text{因为}x^2\ge0`,encoded=encodeDocument(source,options),start=source.indexOf('因为');
 const edited=applyManualBraille(encoded,[{start,end:start+2,cells:'⠁⠃'}]);
 const frames=(r:typeof encoded)=>r.atoms.flatMap(a=>a.kind==='cell' && a.sourceRole==='structure'?[a.cells]:[]);
 expect(frames(edited)).toEqual(frames(encoded));expect(edited.document.source).toBe(source);
});
test('unresolved predicates remain visible instead of disappearing behind the quantifier',()=>{
 const source=String.raw`\forall x,\unknown{x}`,r=convert(source,options);
 expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toContain('⠿');
});
test('a quantifier annotation retains its own direction and ending',()=>{
 const r=convert(String.raw`\overset{\forall}{x}`,options);
 expect(r.complete).toBe(true);expect(r.unicode.endsWith(b(['13456','156']))).toBe(true);
});
test('long quantified formulas preserve identical encoded atoms across wrapping',()=>{
 const source=String.raw`\forall x,abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz`,wide=convert(source,{...options,columns:200}),narrow=convert(source,{...options,columns:30});
 expect(narrow.complete).toBe(true);expect(narrow.lines.length).toBeGreaterThan(1);
 expect(narrow.atoms.flatMap(a=>a.kind==='cell'?[a.cells]:[])).toEqual(wide.atoms.flatMap(a=>a.kind==='cell'?[a.cells]:[]));
});
