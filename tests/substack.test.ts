import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {parseMath} from '../packages/core/src/parser/math';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={mode:'math' as const,paragraphIndent:0};
test('substack retains exact row offsets inside one lower limit',()=>{
 const source=String.raw`\sum_{\substack{i=1\\j=2}}^n A`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 const tree=parseMath(source).body;
 if(tree.kind==='sequence'){const sum=tree.children[0];if(sum.kind==='script'&&sum.sub?.kind==='group'&&sum.sub.body.kind==='sequence'){
  const stack=sum.sub.body.children[0];expect(stack.kind).toBe('matrix');if(stack.kind==='matrix'){expect(stack.environment).toBe('substack');expect(stack.rows.map(row=>row[0].raw)).toEqual(['i=1','j=2']);}
 }}
 expect(r.diagnostics.some(d=>d.code==='math-stack-linearized')).toBe(true);
 expect(r.atoms.some(a=>a.kind==='cell'&&a.rowStart)).toBe(false);
 expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
});
test.each([String.raw`\substack{a+b\\c+d}`,String.raw`x^{\substack{a\\b}}`,String.raw`\frac{\substack{a\\b}}{c}`,String.raw`\bigoplus_{\substack{i=1\\j=2}}^{n} A`,String.raw`\substack{a{b}\\\frac{c}{d}}`])('stack fields retain supported math: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
test('nested stacks keep inner row breaks separate',()=>{
 const source=String.raw`\substack{\substack{a\\b}\\c}`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.diagnostics.filter(d=>d.code==='math-stack-linearized')).toHaveLength(2);
});
test('nested matrix row separators are not outer stack rows',()=>{
 const source=String.raw`\substack{\begin{pmatrix}a&b\\c&d\end{pmatrix}\\x}`,tree=parseMath(source).body,r=convert(source,options);
 expect(r.complete).toBe(false);expect(r.diagnostics.filter(d=>d.code==='math-matrix-context-unverified')).toHaveLength(1);
 if(tree.kind==='sequence'){const stack=tree.children[0];if(stack.kind==='matrix')expect(stack.rows.map(row=>row[0].raw)).toEqual([String.raw`\begin{pmatrix}a&b\\c&d\end{pmatrix}`,'x']);}
});
test('optional row spacing remains visible for review',()=>{
 const source=String.raw`\substack{a\\[2pt]b}`,r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.diagnostics.some(d=>d.code==='math-stack-spacing-unverified')).toBe(true);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
test.each([String.raw`\substack{}`,String.raw`\substack{a\\}`,String.raw`\substack{a\\\unknown}`,String.raw`\substack{a&b}`,String.raw`\substack{a\\b`,String.raw`\substack`])('invalid stack retains visible review output: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
test('unbraced one-token stack argument does not consume the following token',()=>{
 expect(convert(String.raw`\substack ab`,options).unicode).toBe(convert('{a}b',options).unicode);
});
test('document scanner recognizes stack bodies and following supported math',()=>{
 const source=String.raw`\sum_{\substack{i=1\\j=2}}^n A`,r=convert(source,{mode:'document',paragraphIndent:0});
 expect(r.complete).toBe(true);expect(r.diagnostics.some(d=>d.code==='math-stack-linearized')).toBe(true);
});
test('mixed-text stacked conditions retain source word edits and captions',()=>{
 const source=String.raw`\sum_{\substack{\text{因为}i=1\\\text{所以}j=2}}^n A`,r=encodeDocument(source,options),start=source.indexOf('因为');
 expect(r.complete).toBe(true);for(const w of r.metadata.chineseWords)expect(source.slice(w.span.start,w.span.end)).toBe(w.raw);
 const edited=applyManualBraille(r,[{start,end:start+2,cells:'⠁⠃'}]);
 expect(edited.atoms.filter(a=>a.ruleId==='editorial-stack-description')).toEqual(r.atoms.filter(a=>a.ruleId==='editorial-stack-description'));
});
test('deep stacks remain bounded and visible',()=>{
 const source='\\substack{'.repeat(80)+'x'+'}'.repeat(80),r=convert(source,options);
 expect(r.complete).toBe(false);expect(r.diagnostics.some(d=>d.code==='math-depth-limit')).toBe(true);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
test('aligned stack limits keep equation rows and word offsets',()=>{
 const source=String.raw`\begin{aligned}\text{因为}&\sum_{\substack{i=1\\j=2}}^n A\\\text{所以}&x=1\end{aligned}`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.diagnostics.some(d=>d.code==='math-matrix-context-unverified')).toBe(false);
 for(const w of r.metadata.chineseWords)expect(source.slice(w.span.start,w.span.end)).toBe(w.raw);
});
