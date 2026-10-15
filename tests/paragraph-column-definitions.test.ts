import {test,expect} from 'vitest';
import {parseTexColumns} from '../packages/core/src/parser/tex-columns';
import {parseMath} from '../packages/core/src/parser/math';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={mode:'math' as const,columns:30,paragraphIndent:0};
test('paragraph columns preserve widths and exact original spans',()=>{
 const raw='|p{2cm}|m{3em}|b{1.5in}|',r=parseTexColumns(raw,9);
 expect(r.known).toBe(true);expect(r.unresolved).toEqual([]);expect(r.definitions.map(c=>c.type)).toEqual(['p','m','b']);
 for(const c of r.definitions){expect(raw.slice(c.span.start-9,c.span.end-9)).toBe(c.raw);expect(raw.slice(c.width!.span.start-9,c.width!.span.end-9)).toBe(c.width!.raw);}
});
test.each(['tabular','array'])('%s retains paragraph prose, dollar mathematics and three vertical alignments',env=>{
 const source=`\\begin{${env}}{p{2cm}m{2cm}b{2cm}}Title&$x^2$&Other\\end{${env}}`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);expect(r.diagnostics.filter(d=>d.code==='math-paragraph-column-described')).toHaveLength(3);
 const variants=['p','m','b'].map(type=>convert(`\\begin{${env}}{${type}{2cm}}Title\\end{${env}}`,options).unicode);expect(new Set(variants).size).toBe(3);
});
test('bracket normalization retains paragraph column metadata',()=>{
 const source=String.raw`\left[\begin{array}{p{2cm}}Title\end{array}\right]`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.diagnostics.some(d=>d.code==='math-paragraph-column-described')).toBe(true);expect(r.document.source).toBe(source);
});
test('repeated nested column patterns retain logical columns and borders',()=>{
 const raw=String.raw`l*{2}{p{2cm}|*{2}{c}}r`,r=parseTexColumns(raw,0);
 expect(r.known).toBe(true);expect(r.expanded).toBe(true);expect(r.definitions.map(c=>c.type)).toEqual(['l','p','c','c','p','c','c','r']);
 expect(r.rules.map(rule=>rule.beforeColumn)).toEqual([2,5]);
 expect(parseTexColumns('*{0}{Undefined}c',0).definitions.map(c=>c.type)).toEqual(['c']);
 const source=String.raw`\begin{tabular}{*{2}{p{2cm}c}}Title&a&Other&b\end{tabular}`;
 expect(convert(source,options).complete).toBe(true);
});
test('multirow inherited width follows the paragraph column or its multicolumn override',()=>{
 for(const source of [String.raw`\begin{tabular}{p{2cm}c}\multirow{2}{=}{Title}&a\\&b\end{tabular}`,String.raw`\begin{tabular}{cc}\multicolumn{2}{p{3cm}}{\multirow{2}{=}{Title}}\\\multicolumn{2}{c}{}\end{tabular}`]) {
  const r=convert(source,options);expect(r.complete).toBe(true);expect(r.diagnostics.some(d=>d.code==='math-table-column-width-unverified')).toBe(false);expect(r.document.source).toBe(source);
 }
});
test.each([String.raw`\begin{array}{p{\unknown}}Title\end{array}`,String.raw`\begin{tabular}{*{999999999}{c}}Title\end{tabular}`,String.raw`\begin{tabular}{>{\custom}p{2cm}}Title\end{tabular}`,String.raw`\begin{tabular}{p{2cm}}Title&Other\end{tabular}`])('unresolved expressions, limits and declarations keep visible source: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();expect(r.atoms.length).toBeLessThan(5000);
});
test('word edits preserve repeated paragraph-column captions',()=>{
 const source=String.raw`\begin{tabular}{*{2}{p{2cm}}}因为&所以\end{tabular}`,r=encodeDocument(source,options),start=source.indexOf('因为');
 expect(r.complete).toBe(true);const edited=applyManualBraille(r,[{start,end:start+2,cells:'⠁⠃'}]);
 expect(edited.atoms.filter(a=>a.ruleId==='editorial-column-description')).toEqual(r.atoms.filter(a=>a.ruleId==='editorial-column-description'));
});
