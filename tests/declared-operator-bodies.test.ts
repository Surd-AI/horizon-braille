import {test,expect} from 'vitest';
import {parseMath} from '../packages/core/src/parser/math';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {applyManualBraille} from '../packages/core/src/manual-braille';
import {braille} from '../packages/core/src/rules/math-symbols';
const options={mode:'math' as const,paragraphIndent:0};
test.each([String.raw`\mathop{x}`,String.raw`\mathop x+y`,String.raw`\mathop{\mathrm{tr}}A`,String.raw`\mathop{\frac{a+b}{c}}_{n}^{m}`,String.raw`\mathop{\mathbb{E}}\limits_{x>0}`,String.raw`\mathbf{\mathop{x+y}}`,String.raw`\mathop{\mathop{x}}`,String.raw`\mathop{\text{解析}}x`,String.raw`\begin{aligned}\text{因为}&\mathop{\mathrm{tr}}A=1\\\text{所以}&x=1\end{aligned}`])('declared operator retains body fields: %s',source=>{
 const r=convert(source,options);expect(r.complete,JSON.stringify(r.diagnostics)).toBe(true);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();
 expect(r.diagnostics.some(d=>d.code==='math-operator-body-described')).toBe(true);
 expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
});
test('limits and nolimits keep explicit operator script placement distinct',()=>{
 const variants=[String.raw`\mathop{x}_a^b`,String.raw`\mathop{x}\limits_a^b`,String.raw`\mathop{x}\nolimits_a^b`].map(s=>convert(s,options));
 expect(variants.every(r=>r.complete)).toBe(true);expect(variants[0].unicode).toBe(variants[2].unicode);expect(variants[1].unicode).not.toBe(variants[0].unicode);
});
test('an unbraced argument consumes only one atom, preserving following expression',()=>{
 const source=String.raw`\mathop x+y`,r=parseMath(source,{start:0,end:source.length});
 expect(r.body.kind).toBe('sequence');if(r.body.kind!=='sequence')return;
 const op=r.body.children[0];expect(op.kind).toBe('style');if(op.kind!=='style')return;
 expect(op.body.raw).toBe('x');expect(op.operatorLimits).toBe(false);expect(r.body.children.at(-1)?.raw).toBe('y');
});
test.each([String.raw`\mathop{}`,String.raw`\mathop{\quad}`,String.raw`\mathop`,String.raw`\mathop{\unknown{x}}`,String.raw`\mathop{\frac{}{x}}`])('missing or unsupported operator contents remain visible for review: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
test.each([String.raw`\mathop{x}_a`,String.raw`$\mathop{\mathrm{tr}}A$`,String.raw`\mathop{\text{解析}} x`])('document formula detection recognizes declared operators: %s',source=>{
 const r=convert(source,{mode:'document',paragraphIndent:0});expect(r.complete,JSON.stringify(r.diagnostics)).toBe(true);expect(r.document.source).toBe(source);expect(r.document.nodes.some(n=>n.kind==='bare-math'||n.kind==='inline-math')).toBe(true);
});
test('operator-body source words retain manual braille edits and frames',()=>{
 const source=String.raw`\mathop{\text{解析}}x`,r=encodeDocument(source,options),word=r.metadata.chineseWords.find(w=>w.raw==='解析')!;
 const edit=applyManualBraille(r,[{...word.span,cells:'⠁⠃'}]);expect(r.complete).toBe(true);expect(edit.atoms.some(a=>a.ruleId==='manual-braille')).toBe(true);
 expect(edit.atoms.filter(a=>a.ruleId==='editorial-operator-body')).toEqual(r.atoms.filter(a=>a.ruleId==='editorial-operator-body'));
});
test('strict symbol policy retains the body while reviewing its editorial role caption',()=>{
 const r=convert(String.raw`\mathop{x}`,{...options,symbolPolicy:'review-unmapped'});expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toBeTruthy();expect(r.diagnostics.some(d=>d.code==='math-operator-description-unverified')).toBe(true);
});
test('operator bodies preserve inherited native fonts rather than forcing upright names',()=>{
 const source=String.raw`\mathbf{\mathop{x}}`,r=convert(source,options),at=source.indexOf('x');
 const cells=r.atoms.filter(a=>a.kind==='cell'&&a.span.start===at&&a.span.end===at+1).map(a=>a.kind==='cell'?a.cells:'').join('');
 expect(r.complete).toBe(true);expect(cells).toContain(braille(['12456']));
});
test('operator declaration does not promote nested matrices into a verified standalone profile',()=>{
 const source=String.raw`\mathop{\begin{pmatrix}a&b\\c&d\end{pmatrix}}`,r=convert(source,options);
 expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();expect(r.diagnostics.some(d=>d.code==='math-matrix-context-unverified')).toBe(true);
});
