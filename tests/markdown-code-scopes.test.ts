import {test,expect} from 'vitest';
import {parseDocument} from '../packages/core/src/parser/document';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={paragraphIndent:0};
test.each(['```tex\n$x_1$\\unknown\n```\n$y^2$','~~~python\r\nx_1 = "$bad$"\r\n~~~~\r\n$y^2$'])('fences keep code literal and following math active',source=>{
 const d=parseDocument(source),code=d.nodes.find(n=>n.kind==='code-block');
 expect(code?.kind).toBe('code-block');if(!code || code.kind!=='code-block')return;
 expect(code.closed).toBe(true);expect(source.slice(code.contentSpan.start,code.contentSpan.end)).toBe(code.content);
 expect(d.nodes.some(n=>n.kind==='inline-math' && n.content==='y^2')).toBe(true);
 expect(d.nodes.map(n=>n.raw).join('')).toBe(source);
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='math-unknown-command')).toBe(false);
 expect(r.atoms.every(a=>a.span.start>=0 && a.span.end<=source.length)).toBe(true);
});
test.each(['`$x_1$` $y^2$','``a ` b`` $y^2$','`x\r\ny` $z$'])('inline code retains matching run scope and literal whitespace: %s',source=>{
 const d=parseDocument(source);expect(d.nodes.some(n=>n.kind==='code-span')).toBe(true);
 expect(d.nodes.map(n=>n.raw).join('')).toBe(source);
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='markdown-code-literal')).toBe(true);
});
test('an unclosed fence validly retains its complete content to EOF',()=>{
 const source='```tex\n$not_math\n\\unknown',r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.document.nodes.some(n=>n.kind==='code-block' && !n.closed && n.content.endsWith('\\unknown'))).toBe(true);
 expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
test('shorter and mismatched fence characters do not close a block',()=>{
 const d=parseDocument('````\n```\n~~~\nx_1\n````');
 const code=d.nodes[0];expect(code.kind).toBe('code-block');if(code.kind==='code-block')expect(code.content).toBe('```\n~~~\nx_1\n');
});
test('four-space indentation does not become a top-level fenced block',()=>{
 expect(parseDocument('    ```\nx\n    ```').nodes.some(n=>n.kind==='code-block')).toBe(false);
});
test('escaped backticks remain literal and do not open a code span',()=>{
 const d=parseDocument('\\`x\\`');expect(d.nodes.some(n=>n.kind==='code-span')).toBe(false);expect(d.nodes.map(n=>n.raw).join('')).toBe('\\`x\\`');
});
test('explicit math and text modes keep their own domain policies',()=>{
 const source='`$x$`';expect(convert(source,{mode:'text'}).document.nodes.some(n=>n.kind==='code-span')).toBe(false);
 expect(convert(source,{mode:'math'}).complete).toBe(false);
});
test('Chinese code words are real source words while boundary captions stay protected',()=>{
 const source='```\n因为\n```',encoded=encodeDocument(source,options),start=source.indexOf('因为');
 expect(encoded.metadata.chineseWords.map(w=>w.raw)).toEqual(['因为']);
 const edited=applyManualBraille(encoded,[{start,end:start+2,cells:'⠁⠃'}]);
 const captions=(r:typeof encoded)=>r.atoms.flatMap(a=>a.kind==='cell' && a.ruleId==='editorial-code-boundary'?[a.cells]:[]);
 expect(captions(edited)).toEqual(captions(encoded));expect(edited.document.source).toBe(source);
});
