import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const glyphs=['°','–','○','△','★','～','^','@'];
test.each(glyphs)('literal %s stays readable with exact source and protected caption',glyph=>{
 const source=`abc${glyph}def`,r=convert(source,{mode:'text',paragraphIndent:0});
 expect(r.complete).toBe(true);expect(r.unhandled).toEqual([]);expect(r.document.source).toBe(source);
 const caption=r.atoms.filter(a=>a.kind==='cell'&&a.ruleId==='editorial-text-symbol-description');
 expect(caption.length).toBeGreaterThan(2);
 expect(caption.every(a=>a.kind==='cell'&&a.span.start===3&&a.span.end===4&&a.sourceRole==='structure')).toBe(true);
 expect(new Set(caption.map(a=>a.group)).size).toBe(1);
 expect(r.metadata.chineseWords.every(w=>source.slice(w.span.start,w.span.end)===w.raw)).toBe(true);
 expect(r.diagnostics.some(d=>d.code==='text-symbol-described'&&d.span.start===3&&d.span.end===4)).toBe(true);
});
test('glyphs remain distinct from each other and ordinary mathematical marks',()=>{
 const prose=(s:string)=>convert(s,{mode:'text',paragraphIndent:0}).unicode;
 const outputs=glyphs.map(prose);expect(new Set(outputs).size).toBe(glyphs.length);
 for(const plain of ['o','0','-','*','~'])expect(outputs).not.toContain(prose(plain));
});
test.each([String.raw`\text{20°C}`,String.raw`\texttt{abc@def–ghi}`,String.raw`\begin{aligned}\text{★}&x=1\\\text{○}&y=2\end{aligned}`])('descriptions stay in literal math-text fields: %s',source=>{
 const r=convert(source,{mode:'math',paragraphIndent:0});expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='text-symbol-described')).toBe(true);
 expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
});
test('mathematical powers and uncertain operators retain their original interpretation',()=>{
 const power=convert('x^2',{mode:'math',paragraphIndent:0});expect(power.complete).toBe(true);
 expect(power.diagnostics.some(d=>d.code==='text-symbol-described')).toBe(false);
 expect(convert('x*y',{mode:'math'}).complete).toBe(false);
 expect(convert(String.raw`\text{\unknown}`,{mode:'math'}).complete).toBe(false);
});
test('source-word edits leave adjacent glyph captions unchanged',()=>{
 const source=String.raw`\text{因为★所以}`,options={mode:'math' as const,paragraphIndent:0},r=encodeDocument(source,options),start=source.indexOf('因为');
 const edited=applyManualBraille(r,[{start,end:start+2,cells:'⠁⠃'}]);
 const caption=(v:typeof r)=>v.atoms.filter(a=>a.ruleId==='editorial-text-symbol-description');
 expect(caption(edited)).toEqual(caption(r));expect(edited.document.source).toBe(source);
});
test('captions survive narrow layouts without splitting their contents',()=>{
 const source='abc°def–ghi○jkl△mno★pqr',options={mode:'text' as const,paragraphIndent:0};
 const wide=convert(source,{...options,columns:200}),narrow=convert(source,{...options,columns:30});
 expect(narrow.complete).toBe(true);expect(narrow.lines.length).toBeGreaterThan(1);expect(narrow.atoms).toEqual(wide.atoms);
 for(const glyph of glyphs.slice(0,5)) {
  const start=source.indexOf(glyph),cells=narrow.atoms.filter(a=>a.kind==='cell'&&a.span.start===start&&a.span.end===start+1).map(a=>a.kind==='cell'?a.cells:'').join('');
  expect(narrow.lines.some(line=>line.includes(cells))).toBe(true);
 }
});
