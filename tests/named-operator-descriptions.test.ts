import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {applyManualBraille} from '../packages/core/src/manual-braille';
import {braille} from '../packages/core/src/rules/math-symbols';
const options={mode:'math' as const,paragraphIndent:0};
test.each(['FFT','ABC','f','A1','arg max','条件'])('explicit name %s retains its operator role, case and source',name=>{
 const source=`\\operatorname{${name}}(x)`,r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='math-operatorname-described')).toBe(true);
 expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
 expect(convert(source,{...options,symbolPolicy:'review-unmapped'}).complete).toBe(false);
 expect(convert(source,{mode:'document',paragraphIndent:0}).complete).toBe(true);
});
test('starred named operators retain lower/upper limit positions',()=>{
 for(const name of ['FFT','f','rank','sin']){
  const source=`\\operatorname*{${name}}_{i=1}^{n} x`,r=convert(source,options);expect(r.complete).toBe(true);
  const cells=r.atoms.filter(a=>a.kind==='cell').map(a=>a.kind==='cell'?a.cells:'').join('');
  expect(cells).toContain(braille(['46','16']));expect(cells).toContain(braille(['46','34']));
 }
 expect(convert(String.raw`\operatorname{FFT}_{i=1}^{n}x`,options).unicode).not.toBe(convert(String.raw`\operatorname*{FFT}_{i=1}^{n}x`,options).unicode);
});
test('existing native function names keep their checked transcription',()=>{
 expect(convert(String.raw`\operatorname{sin}x`,options).unicode).toBe(convert(String.raw`\sin x`,options).unicode);
 expect(convert(String.raw`\operatorname{rank}x`,options).diagnostics.some(d=>d.code==='math-operatorname-described')).toBe(false);
});
test('explicit limit switches override starred named operators',()=>{
 for(const name of ['FFT','sin']){
  const plain=`\\operatorname{${name}}_{i=1}^{n}x`,nolimits=`\\operatorname*{${name}}\\nolimits_{i=1}^{n}x`;
  expect(convert(nolimits,options).unicode).toBe(convert(plain,options).unicode);
 }
 expect(convert(String.raw`\operatorname{FFT}\limits_{i=1}^{n}x`,options).unicode).toBe(convert(String.raw`\operatorname*{FFT}_{i=1}^{n}x`,options).unicode);
});
test.each([String.raw`\operatorname{}`,String.raw`\operatorname{custom-name}x`,String.raw`\operatorname{\unknown}x`,String.raw`\operatorname{FFT`,String.raw`\operatorname*{}_{a}x`])('invalid operator syntax retains visible output: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
test('names remain distinct from ordinary variables and preserve letter case',()=>{
 expect(convert(String.raw`\operatorname{FFT}`,options).unicode).not.toBe(convert('FFT',options).unicode);
 expect(convert(String.raw`\operatorname{ABC}`,options).unicode).not.toBe(convert(String.raw`\operatorname{ABc}`,options).unicode);
});
test('Chinese operator names remain editable independently of role captions',()=>{
 const source=String.raw`\begin{aligned}\operatorname{条件}&x=1\\\operatorname{对应}&y=2\end{aligned}`,r=encodeDocument(source,options),start=source.indexOf('条件');expect(r.complete).toBe(true);
 const edited=applyManualBraille(r,[{start,end:start+2,cells:'⠁⠃'}]);expect(edited.atoms.filter(a=>a.ruleId==='editorial-operator-description')).toEqual(r.atoms.filter(a=>a.ruleId==='editorial-operator-description'));
});
