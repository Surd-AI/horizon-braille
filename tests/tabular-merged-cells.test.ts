import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {parseMath} from '../packages/core/src/parser/math';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={mode:'math' as const,columns:30,paragraphIndent:0};
function table(source:string) {const root=parseMath(source).body,n=root.kind==='sequence'?root.children[0]:root;if(n.kind!=='matrix')throw new Error('Expected table');return n;}
test('multicolumn advances logical positions by its full width',()=>{
 const source=String.raw`\begin{tabular}{ccc}\multicolumn{2}{|c|}{Title}&Other\\a&b&c\end{tabular}`,r=convert(source,options),n=table(source);
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);expect(n.rows[0]).toHaveLength(2);expect(n.rows[0][0].tableMerge?.columns).toBe(2);
 expect(r.diagnostics.some(d=>d.code==='math-table-merge-described'&&d.message.includes('2 columns'))).toBe(true);
 expect(r.diagnostics.some(d=>d.code.includes('column-count-mismatch'))).toBe(false);
 expect(convert(source,{...options,mode:'document'}).complete).toBe(true);
});
test.each([String.raw`\begin{tabular}{cc}\multirow{2}{*}{Title}&$x^2$\\&$\frac{a}{b}$\end{tabular}`,String.raw`\begin{tabular}{cc}&a\\\multirow{-2}{*}{Title}&b\end{tabular}`,String.raw`\begin{tabular}{ccc}\multicolumn{2}{c}{\multirow{2}{*}{Title}}&a\\\multicolumn{2}{c}{}&b\end{tabular}`])('multirow regions preserve bodies, direction and covered placeholders: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='math-table-merge-described')).toBe(true);
 expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
});
test('vertical options and dimensions retain distinct readable annotations',()=>{
 const source=String.raw`\begin{tabular}{cc}\multirow[t]{2}[t2]{1.5cm}[-2pt]{Title}&a\\&b\end{tabular}`,r=convert(source,options),cell=table(source).rows[0][0];
 expect(r.complete).toBe(true);expect(cell.tableMerge?.annotations.map(a=>a.kind)).toEqual(['width','vpos','bigstruts','vmove']);
 for(const a of cell.tableMerge?.annotations??[])expect(source.slice(a.span.start,a.span.end)).toBe(a.raw);
 expect(r.unicode).not.toBe(convert(source.replace('[t]','[b]'),options).unicode);
});
test('unbraced natural width and both-edge strut prefixes retain TeX spelling',()=>{
 const source=String.raw`\begin{tabular}{cc}\multirow{2}[tb 2]*{Title}&a\\&b\end{tabular}`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(table(source).rows[0][0].tableMerge?.annotations.some(a=>a.kind==='bigstruts'&&a.raw==='tb 2')).toBe(true);
});
test.each([String.raw`\begin{tabular}{cc}\multicolumn{3}{c}{Title}\end{tabular}`,String.raw`\begin{tabular}{cc}\multirow{3}{*}{Title}&a\\&b\end{tabular}`,String.raw`\begin{tabular}{cc}\multirow{-2}{*}{Title}&a\end{tabular}`,String.raw`\begin{tabular}{cc}\multirow{2}{*}{Title}&a\\Occupied&b\end{tabular}`,String.raw`\begin{tabular}{cc}\multirow{1.5}{*}{Title}&a\\&b\end{tabular}`,String.raw`\begin{tabular}{cc}\multicolumn{2}{c}{\multicolumn{1}{c}{Title}}\end{tabular}`,String.raw`\begin{tabular}{cc}\multirow{2}{=}{Title}&a\\&b\end{tabular}`,String.raw`\begin{tabular}{cc}\multirow[z]{2}{*}{Title}&a\\&b\end{tabular}`])('invalid or unresolved spans retain all output: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();
 expect(r.diagnostics.some(d=>d.code.startsWith('math-table-'))).toBe(true);
});
test('large declared spans are bounded rather than allocating a grid',()=>{
 const source=String.raw`\begin{tabular}{c}\multirow{9007199254740991}{*}{Title}\end{tabular}`,r=convert(source,options);
 expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.atoms.length).toBeLessThan(1000);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
test('word edits preserve merge coordinates and option captions',()=>{
 const source=String.raw`\begin{tabular}{cc}\multicolumn{2}{c}{因为 $x^2$}\\a&b\end{tabular}`,r=encodeDocument(source,options),start=source.indexOf('因为');
 expect(r.complete).toBe(true);const edited=applyManualBraille(r,[{start,end:start+2,cells:'⠁⠃'}]);
 expect(edited.atoms.filter(a=>a.ruleId==='editorial-table-description')).toEqual(r.atoms.filter(a=>a.ruleId==='editorial-table-description'));
 for(const w of r.metadata.chineseWords)expect(source.slice(w.span.start,w.span.end)).toBe(w.raw);
});
