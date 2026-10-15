import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {parseMath} from '../packages/core/src/parser/math';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={mode:'math' as const,columns:30,paragraphIndent:0};
const table=String.raw`\begin{tabular}{|l||r|}\hline because&$\frac{a}{b}$\\because&$x^2$\\\hline\end{tabular}`;
test('prose tables preserve text, formulas, row/column identity and rules',()=>{
 const r=convert(table,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(table);
 expect(r.diagnostics.some(d=>d.code==='math-table-linearized')).toBe(true);
 expect(r.diagnostics.filter(d=>d.code==='math-table-rule-described')).toHaveLength(2);
 expect(r.atoms.some(a=>a.ruleId==='editorial-table-description')).toBe(true);
 expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=table.length)).toBe(true);
 expect(convert(table,{...options,mode:'document'}).complete).toBe(true);
 const body=parseMath(table).body,n=body.kind==='sequence'?body.children[0]:body;
 expect(n.kind).toBe('matrix');if(n.kind==='matrix'){expect(n.environment).toBe('tabular');expect(n.rows.map(row=>row.length)).toEqual([2,2]);}
});
test.each([String.raw`\begin{tabular}[t]{cc}a&b\\\end{tabular}`,String.raw`\begin{tabular}{cc}a&b\end{tabular}`,String.raw`\begin{tabular}{cc}a&\\&b\end{tabular}`])('trailing row terminators and empty cells retain exact shape: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 const root=parseMath(source).body,n=root.kind==='sequence'?root.children[0]:root;
 if(n.kind==='matrix')expect(n.rows).toHaveLength(source.includes('&\\\\&')?2:1);else throw new Error('Expected table');
});
test('partial rules preserve their inclusive column range',()=>{
 const source=String.raw`\begin{tabular}{ccc}a&b&c\\\cline{2-3}d&e&f\end{tabular}`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 const root=parseMath(source).body,n=root.kind==='sequence'?root.children[0]:root;
 if(n.kind==='matrix')expect(n.rowRules?.[0].columns).toEqual({first:2,last:3});else throw new Error('Expected table');
 expect(r.unicode).not.toBe(convert(source.replace('2-3','1-3'),options).unicode);
});
test.each([String.raw`\begin{tabular}{cc}a&b\\\cline{3-1}c&d\end{tabular}`,String.raw`\begin{tabular}{cc}a\end{tabular}`,String.raw`\begin{tabular}{X}a\end{tabular}`,String.raw`\begin{tabular}{c}\multicolumn{2}{c}{abc}\end{tabular}`,String.raw`\begin{tabular}{c}$x\end{tabular}`])('uncertain declarations, merged cells and malformed inline math stay visible: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
test('Chinese word edits do not replace generated coordinates',()=>{
 const source=String.raw`\begin{tabular}{cc}因为&$x^2$\\所以&$x=1$\end{tabular}`,r=encodeDocument(source,options),start=source.indexOf('因为');
 expect(r.complete).toBe(true);for(const word of r.metadata.chineseWords)expect(source.slice(word.span.start,word.span.end)).toBe(word.raw);
 const edited=applyManualBraille(r,[{start,end:start+2,cells:'⠁⠃'}]);
 expect(edited.atoms.filter(a=>a.ruleId==='editorial-table-description')).toEqual(r.atoms.filter(a=>a.ruleId==='editorial-table-description'));
});
test('escaped separators stay in the cell while dollar math remains scoped',()=>{
 const source=String.raw`\begin{tabular}{cc}a\&b&$a+b$\end{tabular}`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
});
