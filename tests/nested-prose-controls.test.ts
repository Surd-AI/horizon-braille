import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {parseMath} from '../packages/core/src/parser/math';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={mode:'math' as const,columns:30,paragraphIndent:0};
test.each(['text','mbox','textit','textbf','textrm','texttt','textsf','textcircled'])('nested %s keeps its own scope and original text',(name)=>{
 const source=`\\text{abc \\${name}{因为 $x^2$} def}`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
 const w=r.metadata.chineseWords.find(w=>w.raw==='因为');expect(w).toBeDefined();expect(source.slice(w!.span.start,w!.span.end)).toBe('因为');
 if(!['text','mbox','textcircled'].includes(name))expect(r.diagnostics.some(d=>d.code==='math-font-described')).toBe(true);
});
test.each(['textbackslash','textasciitilde','textasciicircum','textless','textgreater'])('literal control %s retains its full command span and delimiter semantics',name=>{
 const source=`\\text{a\\${name} b}`,r=convert(source,options),start=source.indexOf('\\'+name);
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.atoms.some(a=>a.span.start===start&&a.span.end===start+name.length+1)).toBe(true);
 expect(r.diagnostics.some(d=>d.code==='math-unknown-command'||d.code==='math-text-unhandled')).toBe(false);
 expect(convert(`\\text{\\${name}Anything}`,options).complete).toBe(false);
});
test('nested font identities do not collapse',()=>{
 expect(convert(String.raw`\text{\textbf{abc}}`,options).unicode).not.toBe(convert(String.raw`\text{\textit{abc}}`,options).unicode);
 expect(convert(String.raw`\text{\textbf{abc}}`,{...options,fontPolicy:'review-unmapped'}).complete).toBe(false);
});
test.each([String.raw`\begin{aligned}\text{\textbf{因为}}&x=1\\\text{\textit{所以}}&x^2=1\end{aligned}`,String.raw`\begin{tabular}{p{2cm}c}\textbf{因为}&$x^2$\end{tabular}`])('mixed environments retain nested prose and editable words: %s',source=>{
 const r=encodeDocument(source,options),start=source.indexOf('因为');expect(r.complete).toBe(true);
 const edited=applyManualBraille(r,[{start,end:start+2,cells:'⠁⠃'}]);expect(edited.document.source).toBe(source);
 expect(edited.atoms.filter(a=>a.ruleId==='editorial-font-description')).toEqual(r.atoms.filter(a=>a.ruleId==='editorial-font-description'));
});
test.each([String.raw`\text{\textbf{}}`,String.raw`\text{\textsf{\unknown}}`,String.raw`\text{\textbf{abc}`,String.raw`\text{\textbfAnything{abc}}`])('empty, malformed or unknown nested controls remain visible: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
test('nested prose controls obey the shared parser depth bound',()=>{
 let source='abc';for(let i=0;i<12;i++)source=`\\text{${source}}`;
 expect(parseMath(source,undefined,{maxDepth:5}).diagnostics.some(d=>d.code==='math-depth-limit')).toBe(true);
});
