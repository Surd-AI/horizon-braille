import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {applyManualBraille} from '../packages/core/src/manual-braille';
import {braille} from '../packages/core/src/rules/math-symbols';
const options={mode:'math' as const,paragraphIndent:0};
const pairs=[['oplus','⊕'],['otimes','⊗'],['odot','⊙'],['ominus','⊖'],['oslash','⊘'],['bullet','∙'],['wedge','∧'],['vee','∨'],['dagger','†'],['ddagger','‡']];

test.each(pairs)('%s retains the same readable identity as %s', (command,glyph)=>{
 const source=`a\\${command} b`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.unhandled).toEqual([]);
 expect(r.unicode).toBe(convert(`a${glyph}b`,options).unicode);
 expect(convert(source,{paragraphIndent:0}).complete).toBe(true);
 expect(r.diagnostics.some(d=>d.code==='math-symbol-described')).toBe(true);
 expect(r.document.source).toBe(source);expect(r.metadata.chineseWords).toEqual([]);
 expect(r.atoms.every(a=>a.span.start>=0 && a.span.end<=source.length)).toBe(true);
});

test.each([['land','wedge'],['lor','vee']])('%s and %s preserve the same glyph without selecting a logical interpretation',(alias,name)=>{
 expect(convert(`p\\${alias} q`,options).unicode).toBe(convert(`p\\${name} q`,options).unicode);
});

test('circled operations do not collapse into arithmetic or each other',()=>{
 const values=['oplus','otimes','odot'].map(name=>convert(`A\\${name} B`,options).unicode);
 expect(new Set(values).size).toBe(3);expect(values).not.toContain(convert('A+B',options).unicode);
 expect(values).not.toContain(convert(String.raw`A\times B`,options).unicode);
});

test('dagger indices preserve position and do not become transpose',()=>{
 const upper=convert(String.raw`A^{\dagger}`,options),lower=convert(String.raw`A_{\dagger}`,options);
 expect(upper.complete).toBe(true);expect(lower.complete).toBe(true);
 expect(upper.unicode).not.toBe(convert(String.raw`A^{\top}`,options).unicode);
 expect(upper.unicode).not.toBe(lower.unicode);expect(upper.unicode.endsWith(braille(['13456','156']))).toBe(true);
});

test.each([String.raw`\frac{a\oplus b}{c\otimes d}`,String.raw`\begin{aligned}p&=a\odot b\\q&=c\wedge d\end{aligned}`,String.raw`\overset{\dagger}{x}`,String.raw`\boxed{a\vee b}`])('descriptions retain nested fields and surrounding structure: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.unicode).toBeTruthy();expect(r.diagnostics.some(d=>d.severity==='error')).toBe(false);
});

test('unknown arguments remain visible inside a described operation',()=>{
 const source=String.raw`a\oplus\unknown{x}`,r=convert(source,options);
 expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toContain('⠿');expect(r.document.source).toBe(source);
});

test('source word edits preserve generated symbol descriptions',()=>{
 const source=String.raw`\text{因为}a\oplus b`,encoded=encodeDocument(source,options),start=source.indexOf('因为');
 const edited=applyManualBraille(encoded,[{start,end:start+2,cells:'⠁⠃'}]);
 const frames=(r:typeof encoded)=>r.atoms.flatMap(a=>a.kind==='cell' && a.sourceRole==='structure'?[a.cells]:[]);
 expect(frames(edited)).toEqual(frames(encoded));expect(edited.document.source).toBe(source);
});

test('review policy keeps absent native signs unresolved and source-visible',()=>{
 const r=convert(String.raw`a\oplus b`,{...options,symbolPolicy:'review-unmapped'});
 expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toContain('⠿');
 expect(r.diagnostics.some(d=>d.code==='math-symbol-described')).toBe(false);
});
