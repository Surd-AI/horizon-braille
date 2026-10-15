import {test,expect} from 'vitest';
import {parseMath} from '../packages/core/src/parser/math';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={mode:'math' as const,paragraphIndent:0};
test('column borders retain positions, multiplicity and source offsets',()=>{
 const source=String.raw`\begin{array}{ | c || r | }a&b\\c&d\end{array}`,parsed=parseMath(source).body,body=parsed.kind==='sequence'?parsed.children[0]:parsed;
 expect(body.kind).toBe('matrix');if(body.kind!=='matrix')return;
 expect(body.columnCount).toBe(2);expect(body.columnRules?.map(rule=>rule.beforeColumn)).toEqual([0,1,2]);expect(body.columnRules?.map(rule=>rule.count)).toEqual([1,2,1]);
 expect(body.columnRules?.every(rule=>source.slice(rule.span.start,rule.span.end)===rule.raw)).toBe(true);
 expect(body.rows.map(row=>row.length)).toEqual([2,2]);
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.diagnostics.filter(d=>d.code==='math-column-rule-described')).toHaveLength(3);
 expect(r.metadata.chineseWords).toEqual([]);
});
test('many parallel borders retain their exact count without multiplication by each individual line',()=>{
 const source='\\begin{array}{'+'|'.repeat(100)+'c}'+'x\\\\'.repeat(40)+'x\\end{array}',r=convert(source,{...options,columns:60});
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='math-column-rule-described' && d.message.startsWith('100 '))).toBe(true);
 expect(r.atoms.length).toBeLessThan(2000);
});
test.each([String.raw`\left[\begin{array}{c|c}\hline a&b\\c&d\\\hline\end{array}\right]`,String.raw`\begin{array}{|c|}x\end{array}`])('rules survive bracket normalization and one-cell arrays: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.unicode).toBeTruthy();expect(r.document.source).toBe(source);
 expect(r.atoms.some(a=>a.kind==='cell' && a.ruleId==='editorial-column-rule-description')).toBe(true);
});
test('table borders are distinct from arithmetic absolute-value bars',()=>{
 expect(convert(String.raw`\begin{array}{|c|}x\end{array}`,options).unicode).not.toBe(convert('|x|',options).unicode);
});
test.each([String.raw`\begin{array}{|cc|}x\end{array}`,String.raw`\begin{array}{||}x\end{array}`,String.raw`\begin{array}{|X|}x\end{array}`])('invalid or unsupported columns remain source-visible: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
test('reading edits preserve generated column boundaries',()=>{
 const source=String.raw`\begin{array}{|c|}\text{因为}\end{array}`,encoded=encodeDocument(source,options),start=source.indexOf('因为');
 const edited=applyManualBraille(encoded,[{start,end:start+2,cells:'⠁⠃'}]);
 const structure=(r:typeof encoded)=>r.atoms.flatMap(a=>a.kind==='cell' && a.sourceRole==='structure'?[a.cells]:[]);
 expect(structure(edited)).toEqual(structure(encoded));expect(edited.document.source).toBe(source);
});
test('mismatched declarations are retained once without multiplied border output',()=>{
 const source='\\begin{array}{'+'c|'.repeat(100)+'}'+'x\\\\'.repeat(40)+'x\\end{array}',r=convert(source,options);
 expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.preview?.truncated).not.toBe(true);
 expect(r.atoms.some(a=>a.kind==='cell' && a.ruleId==='editorial-array-column-specification')).toBe(true);
 expect(r.atoms.length).toBeLessThan(2000);
});
