import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {GREEK_VARIANTS,braille} from '../packages/core/src/rules/math-symbols';
import {encodeText} from '../packages/core/src/rules/text';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const entries=Object.entries(GREEK_VARIANTS),options={mode:'math' as const,paragraphIndent:0};
test.each(entries)('declared %s retains native letter and readable original form name',(name,form)=>{
 const source=`\\${name}`,r=convert(source,options),standard=convert(`\\${form.name}`,options);
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);expect(r.unicode).not.toBe(standard.unicode);
 const letter=r.atoms.filter(a=>a.kind==='cell'&&a.ruleId==='GBT18028-2010-5.2').map(a=>a.kind==='cell'?a.cells:'').join('');
 expect(letter).toBe(standard.atoms.filter(a=>a.kind==='cell'&&a.ruleId==='GBT18028-2010-5.2').map(a=>a.kind==='cell'?a.cells:'').join(''));
 const spelling=r.atoms.filter(a=>a.kind==='cell'&&a.ruleId==='editorial-greek-variant-name').map(a=>a.kind==='cell'?a.cells:'').join('');
 expect(spelling).toBe(encodeText(name,0).atoms.map(a=>a.cells).join(''));
 expect(r.atoms.every(a=>a.span.start===0&&a.span.end===source.length)).toBe(true);
});
test.each(entries)('standard and %s variables remain distinct inside one expression',(name,form)=>{
 const source=`\\${form.name}+\\${name}`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);expect(r.unicode).not.toBe(convert(`\\${form.name}+\\${form.name}`,options).unicode);
});
test.each(entries)('separate document fields retain %s without cross-field flattening',(name,form)=>{
 const source=`$\\${form.name}$ $\\${name}$`,r=convert(source,{mode:'document',paragraphIndent:0});
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);expect(r.diagnostics.filter(d=>d.code==='math-greek-variant-described')).toHaveLength(1);
});
test.each(entries)('inherited bold font remains attached to the %s Greek letter',(name)=>{
 const source=`\\mathbf{\\${name}}`,r=convert(source,options);
 const cells=r.atoms.filter(a=>a.kind==='cell'&&a.ruleId==='GBT18028-2010-5.2').map(a=>a.kind==='cell'?a.cells:'').join('');
 expect(r.complete).toBe(true);expect(cells).toContain(braille(['12456']));
});
test.each([String.raw`\frac{\phi+\varphi}{\theta+\vartheta}`,String.raw`\begin{aligned}\phi&=1\\\varphi&=2\end{aligned}`,String.raw`\begin{pmatrix}\sigma&\varsigma\end{pmatrix}`])('compound fields preserve declared forms: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);expect(r.lines.every(l=>l.length<=30)).toBe(true);
});
test('review policy retains letter/name while leaving the editorial identity for review',()=>{
 const r=convert(String.raw`\phi+\varphi`,{...options,symbolPolicy:'review-unmapped'});expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toBeTruthy();expect(r.diagnostics.some(d=>d.code==='math-greek-variant-description-unverified')).toBe(true);
});
test('Chinese word edits retain neighboring Greek form names',()=>{
 const source=String.raw`\begin{aligned}\text{解析}&\phi+\varphi=1\end{aligned}`,r=encodeDocument(source,options),word=r.metadata.chineseWords.find(w=>w.raw==='解析')!;
 const edited=applyManualBraille(r,[{...word.span,cells:'⠁⠃'}]);expect(r.complete).toBe(true);
 expect(edited.atoms.filter(a=>a.ruleId.startsWith('editorial-greek-variant'))).toEqual(r.atoms.filter(a=>a.ruleId.startsWith('editorial-greek-variant')));
});
