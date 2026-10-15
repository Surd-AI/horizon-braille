import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {encodeText} from '../packages/core/src/rules/text';
import {parseMath} from '../packages/core/src/parser/math';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={mode:'math' as const,paragraphIndent:0};
test.each(['tikzpicture','circuitikz','custom','custom*'])('unknown %s retains readable body rather than one placeholder',name=>{
 const source=`a+\\begin{${name}}x+2\\end{${name}}+b`,r=convert(source,options);
 expect(r.complete).toBe(false);expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='math-environment-source-transcribed')).toBe(true);
 expect(r.atoms.map(a=>a.kind==='cell'?a.cells:'').join('')).toContain(encodeText('x+2',0).atoms.map(a=>a.cells).join(''));
 expect(r.atoms.some(a=>a.ruleId==='unhandled-environment-name')).toBe(true);
 for(const glyph of ['a','b'])expect(r.atoms.some(a=>source.slice(a.span.start,a.span.end)===glyph)).toBe(true);
 expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
});
test('nested same-name environments retain the outer matching boundary',()=>{
 const source=String.raw`\begin{custom}a\begin{custom}b\end{custom}c\end{custom}+d`,tree=parseMath(source).body;
 expect(tree.kind).toBe('sequence');if(tree.kind==='sequence') {
  const unknown=tree.children[0];expect(unknown.kind).toBe('unknown');
  if(unknown.kind==='unknown')expect(unknown.sourcePayload?.value).toBe(String.raw`a\begin{custom}b\end{custom}c`);
 }
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toBeTruthy();
 expect(r.atoms.some(a=>source.slice(a.span.start,a.span.end)==='d')).toBe(true);
});
test('escaped closing words do not consume the environment boundary',()=>{
 const source=String.raw`\begin{custom}a\\end{custom}b\end{custom}+c`,tree=parseMath(source).body;
 if(tree.kind==='sequence'&&tree.children[0].kind==='unknown')expect(tree.children[0].sourcePayload?.value).toBe(String.raw`a\\end{custom}b`);
 else throw new Error('Expected retained unknown source');
});
test('commented ends and whitespace around real markers retain the whole body',()=>{
 const source='\\begin {custom}a%\\end{custom}\n b\\end {custom}+c',tree=parseMath(source).body;
 if(tree.kind==='sequence'&&tree.children[0].kind==='unknown')expect(tree.children[0].sourcePayload?.value).toBe('a%\\end{custom}\n b');
 else throw new Error('Expected retained unknown source');
 expect(convert(source,options).atoms.some(a=>source.slice(a.span.start,a.span.end)==='c')).toBe(true);
});
test('unterminated environments retain their full remaining source',()=>{
 const source=String.raw`x+\begin{custom}\draw (1,2);`,r=convert(source,options);
 expect(r.complete).toBe(false);expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='math-unclosed-environment')).toBe(true);
 expect(r.atoms.some(a=>source.slice(a.span.start,a.span.end)==='draw')).toBe(true);
});
test('literal source is explicitly not reinterpreted as a drawing or equation',()=>{
 const source=String.raw`\begin{tikzpicture}\draw (0,0)--(1,1);\end{tikzpicture}`,r=convert(source,options);
 expect(r.complete).toBe(false);expect(r.diagnostics.some(d=>d.code==='math-unsupported-environment')).toBe(true);
 expect(r.diagnostics.some(d=>d.code==='text-symbol-described'&&source.slice(d.span.start,d.span.end)==='\\')).toBe(true);
 expect(r.atoms.some(a=>source.slice(a.span.start,a.span.end)==='draw')).toBe(true);
});
test('original line breaks and Chinese edits retain body and wrapper identity',()=>{
 const source='\\begin{custom}因为\r\n所以\\end{custom}',r=encodeDocument(source,options),start=source.indexOf('因为');
 const edited=applyManualBraille(r,[{start,end:start+2,cells:'⠁⠃'}]);
 expect(r.atoms.some(a=>a.ruleId==='unhandled-source-line-break'&&source.slice(a.span.start,a.span.end)==='\r\n')).toBe(true);
 for(const w of r.metadata.chineseWords)expect(source.slice(w.span.start,w.span.end)).toBe(w.raw);
 expect(edited.atoms.filter(a=>a.ruleId==='unhandled-environment-name')).toEqual(r.atoms.filter(a=>a.ruleId==='unhandled-environment-name'));
 expect(edited.document.source).toBe(source);
});
test('long bodies survive narrow layout as output or a retained preview',()=>{
 const source='\\begin{custom}'+('abc+def '.repeat(20))+'\\end{custom}',wide=convert(source,{...options,columns:100}),narrow=convert(source,{...options,columns:10});
 expect(narrow.complete).toBe(false);expect(narrow.atoms).toEqual(wide.atoms);
 expect(narrow.unicode||narrow.preview?.unicode).toBeTruthy();expect(narrow.document.source).toBe(source);
});
