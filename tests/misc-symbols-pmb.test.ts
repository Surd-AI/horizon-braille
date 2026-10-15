import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={mode:'math' as const,paragraphIndent:0};
const glyphs=[['vdash','⊢'],['hookrightarrow','↪'],['hookleftarrow','↩'],['leadsto','⇝'],['sharp','♯'],['flat','♭'],['natural','♮'],['surd','√'],['sqcup','⊔'],['sqcap','⊓'],['ni','∋']];
test.each(glyphs)('%s retains readable glyph identity and source spans',(name,glyph)=>{
 const source=`a\\${name} b`,r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.unicode).toBe(convert(`a${glyph}b`,options).unicode);
 expect(r.diagnostics.some(d=>d.code==='math-symbol-described')).toBe(true);
 expect(r.metadata.chineseWords).toEqual([]);
 expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
 expect(convert(source,{...options,symbolPolicy:'review-unmapped'}).complete).toBe(false);
});
test('equivalent command names agree, while arrow and set shapes stay distinct',()=>{
 expect(convert(String.raw`a\rightsquigarrow b`,options).unicode).toBe(convert(String.raw`a\leadsto b`,options).unicode);
 expect(convert(String.raw`a\owns b`,options).unicode).toBe(convert(String.raw`a\ni b`,options).unicode);
 expect(new Set(['hookrightarrow','hookleftarrow','leadsto','rightarrow'].map(n=>convert(`a\\${n} b`,options).unicode)).size).toBe(4);
 expect(new Set(['sqcup','sqcap','cup','cap'].map(n=>convert(`a\\${n} b`,options).unicode)).size).toBe(4);
});
test('surd is a standalone glyph without an invented radicand',()=>{
 const r=convert(String.raw`\surd`,options);expect(r.complete).toBe(true);
 expect(r.diagnostics.some(d=>d.code==='math-missing-argument')).toBe(false);
 expect(r.unicode).not.toBe(convert(String.raw`\sqrt{x}`,options).unicode);
});
test.each([String.raw`\frac{a\hookrightarrow b}{c\ni d}`,String.raw`x^{\sharp}`,String.raw`\begin{aligned}\text{因为}&a\vdash b\\\text{所以}&c\sqcup d\end{aligned}`])('glyphs preserve compound fields and mixed text: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 for(const w of r.metadata.chineseWords)expect(source.slice(w.span.start,w.span.end)).toBe(w.raw);
});
test('unknown content beside a known glyph remains visible',()=>{
 const source=String.raw`a\hookrightarrow\unknown{b}`,r=convert(source,options);expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toContain('⠿');expect(r.document.source).toBe(source);
});
test('pmb retains the complete one-argument body and restores following font',()=>{
 const source=String.raw`\pmb{A+B}C`,r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='math-font-described')).toBe(true);
 expect(convert(source,{...options,fontPolicy:'review-unmapped'}).complete).toBe(false);
 const body=(s:string)=>{const v=convert(s,options);return v.atoms.filter(a=>a.kind==='cell'&&['A','B'].includes(s.slice(a.span.start,a.span.end))).map(a=>a.kind==='cell'?a.cells:'');};
 expect(body(String.raw`\mathit{\pmb{A+B}}`)).toEqual(body(String.raw`\mathit{A+B}`));
});
test('pmb preserves Chinese word edits without changing its caption',()=>{
 const source=String.raw`\pmb{\text{因为}A+B}`,r=encodeDocument(source,options),start=source.indexOf('因为');expect(r.complete).toBe(true);
 const edited=applyManualBraille(r,[{start,end:start+2,cells:'⠁⠃'}]);
 expect(edited.atoms.filter(a=>a.ruleId==='editorial-font-description')).toEqual(r.atoms.filter(a=>a.ruleId==='editorial-font-description'));
});
test.each([String.raw`\pmb{}`,String.raw`\pmb`,String.raw`\pmb{\unknown}`])('invalid pmb content retains output: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
test('document scanner recognizes glyph and pmb commands',()=>{
 for(const source of [String.raw`a\hookrightarrow b`,String.raw`\pmb{A+B}`])expect(convert(source,{mode:'document',paragraphIndent:0}).complete).toBe(true);
});
