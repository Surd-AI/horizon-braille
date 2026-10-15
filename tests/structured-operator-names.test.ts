import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {applyManualBraille} from '../packages/core/src/manual-braille';
import {braille} from '../packages/core/src/rules/math-symbols';
const options={mode:'math' as const,paragraphIndent:0};
test.each([String.raw`\operatorname{\mathrm{FFT}}(x)`,String.raw`\operatorname{\arg\min}_{x} f(x)`,String.raw`\operatorname{\text{条件}}x`,String.raw`\operatorname{\hat{A}}x`,String.raw`\operatorname{\sum_{i=1}^{n}}x`,String.raw`\operatorname{\operatorname{FFT}}x`])('structured operator body retains its fields: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='math-operatorname-described')).toBe(true);
 expect(r.diagnostics.some(d=>d.code==='math-operatorname-unverified')).toBe(false);
 expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
});
test('outer starred operator limits remain outside inner structured name',()=>{
 const source=String.raw`\operatorname*{\mathrm{FFT}}_{i=1}^{n}x`,r=convert(source,options);expect(r.complete).toBe(true);
 const cells=r.atoms.filter(a=>a.kind==='cell').map(a=>a.kind==='cell'?a.cells:'').join('');
 expect(cells).toContain(braille(['46','16']));expect(cells).toContain(braille(['46','34']));
 expect(r.unicode).not.toBe(convert(String.raw`\operatorname{\mathrm{FFT}}_{i=1}^{n}x`,options).unicode);
});
test('Chinese structured operator names retain word edits independently of captions',()=>{
 const source=String.raw`\begin{aligned}\operatorname{\text{条件}}&x=1\\\operatorname{\text{对应}}&y=2\end{aligned}`,r=encodeDocument(source,options),start=source.indexOf('条件');
 expect(r.complete).toBe(true);for(const w of r.metadata.chineseWords)expect(source.slice(w.span.start,w.span.end)).toBe(w.raw);
 const edited=applyManualBraille(r,[{start,end:start+2,cells:'⠁⠃'}]);expect(edited.atoms.filter(a=>a.ruleId==='editorial-operator-description')).toEqual(r.atoms.filter(a=>a.ruleId==='editorial-operator-description'));
});
test.each([String.raw`\operatorname{\unknown}x`,String.raw`\operatorname{\mathrm{}}x`,String.raw`\operatorname{\quad}x`,String.raw`\operatorname{\frac{a}{}}x`,String.raw`\operatorname{\mathrm{FFT}`])('unverified/empty structured bodies retain source: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
test('recursive structured operator names respect resource limits',()=>{
 const source='\\operatorname{'.repeat(80)+'x'+'}'.repeat(80),r=convert(source,options);expect(r.complete).toBe(false);expect(r.diagnostics.some(d=>d.code==='math-depth-limit')).toBe(true);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
test('document input preserves structured named operator conversion',()=>{
 const source=String.raw`\operatorname{\mathrm{FFT}}(x)`,r=convert(source,{mode:'document',paragraphIndent:0});expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
});
test('native-only review still flags a described structured operator role',()=>{
 const r=convert(String.raw`\operatorname{\mathrm{FFT}}x`,{...options,symbolPolicy:'review-unmapped'});expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
test('a matrix inside a named operator still requires structural placement review',()=>{
 const source=String.raw`\operatorname{\begin{pmatrix}a&b\\c&d\end{pmatrix}}x`,r=convert(source,options);expect(r.complete).toBe(false);expect(r.diagnostics.some(d=>d.code==='math-matrix-context-unverified')).toBe(true);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
