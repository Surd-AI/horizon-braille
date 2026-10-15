import {test,expect} from 'vitest';
import {parseMath} from '../packages/core/src/parser/math';
import {convert} from '../packages/core/src/convert';
const options={mode:'math' as const,paragraphIndent:0};
test('rules retain exact boundary positions without introducing data rows',()=>{
 const source=String.raw`\begin{array}{cc}\hline a&b\\\hline\hline c&d\\\hline\end{array}`,parsed=parseMath(source).body,body=parsed.kind==='sequence'?parsed.children[0]:parsed;
 expect(body.kind).toBe('matrix');if(body.kind!=='matrix')return;
 expect(body.rows.map(row=>row.length)).toEqual([2,2]);
 expect(body.rowRules?.map(rule=>rule.beforeRow)).toEqual([0,1,1,2]);
 expect(body.rowRules?.every(rule=>source.slice(rule.span.start,rule.span.end)===rule.raw)).toBe(true);
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.diagnostics.filter(d=>d.code==='math-row-rule-described')).toHaveLength(4);
 expect(r.metadata.chineseWords).toEqual([]);
});
test.each([String.raw`\left[\begin{array}{cc}\hline a&b\\c&d\\\hline\end{array}\right]`,String.raw`\begin{pmatrix}\hline a&b\\c&d\\\hline\end{pmatrix}`])('bracketed matrix retains rules and data: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.unicode).toBeTruthy();expect(r.document.source).toBe(source);
 expect(r.diagnostics.filter(d=>d.code==='math-row-rule-described')).toHaveLength(2);
});
test.each([String.raw`\hline x`,String.raw`\begin{array}{c}x\hline\end{array}`,String.raw`\begin{array}{c}\hline\end{array}`])('misplaced or content-free rule remains visible: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
