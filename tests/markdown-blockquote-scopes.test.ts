import {test,expect} from 'vitest';
import {parseDocument} from '../packages/core/src/parser/document';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={mode:'document' as const,paragraphIndent:0};
test.each([['> 因为 $x=1$',1],['>> 条件 $x>0$',2],['> > > 对应 $A=B$',3],['   > 相同 $a=b$',1]])('explicit quote %s retains level %s',(source,level)=>{
 const r=convert(source as string,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.document.nodes.some(n=>n.kind==='markdown-marker'&&n.role==='blockquote'&&n.level===level)).toBe(true);
 expect(r.document.nodes.some(n=>n.kind==='inline-math')).toBe(true);
 let cursor=0;for(const n of r.document.nodes){expect(n.span.start).toBe(cursor);expect((source as string).slice(n.span.start,n.span.end)).toBe(n.raw);cursor=n.span.end;}expect(cursor).toBe((source as string).length);
});
test('headings and lists inside an explicit quote retain their own markers',()=>{
 const source='> ## 条件 ##\n> 7. 对应 $x=1$\n> - 向量 $A=B$',r=convert(source,options);
 expect(r.complete).toBe(true);
 expect(r.document.nodes.filter(n=>n.kind==='markdown-marker').map(n=>n.kind==='markdown-marker'?n.role:'')).toEqual(['blockquote','heading','heading-end','blockquote','list-item','blockquote','list-item']);
});
test('quoted fenced code retains literal content and physical prefix mappings',()=>{
 const source='> ```tex\n> $x$ \\unknown\n> > code\n> ```\n\n$x=1$',r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 const code=r.document.nodes.find(n=>n.kind==='code-block');expect(code?.kind).toBe('code-block');if(code?.kind==='code-block'){
  expect(code.closed).toBe(true);expect(code.quoteLinePrefixes).toHaveLength(2);expect(code.content).toContain('> $x$');
  for(const p of code.quoteLinePrefixes??[])expect(source.slice(p.span.start,p.span.end)).toBe('> ');
 }
 expect(r.document.nodes.filter(n=>n.kind==='inline-math')).toHaveLength(1);
 expect(r.diagnostics.some(d=>d.code==='math-unknown-command')).toBe(false);
 expect(r.atoms.some(a=>a.ruleId==='editorial-code-quote-prefix')).toBe(true);
});
test('nested quoted fences consume exactly their container depth',()=>{
 const source='>> ~~~txt\n>> > raw\n>> ~~~\n\n$x=1$',r=convert(source,options);expect(r.complete).toBe(true);
 const code=r.document.nodes.find(n=>n.kind==='code-block');if(code?.kind==='code-block'){expect(code.closed).toBe(true);expect(code.quoteLinePrefixes?.[0].level).toBe(2);expect(source.slice(code.quoteLinePrefixes![0].span.end,code.contentSpan.end)).toContain('> raw');}
});
test('an unclosed quoted fence does not consume the following unquoted document',()=>{
 const source='> ```txt\n> literal $x$\n\n$y=2$',r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='markdown-quoted-code-unclosed')).toBe(true);expect(r.document.nodes.some(n=>n.kind==='inline-math'&&n.content==='y=2')).toBe(true);
});
test.each(['$a>b$','abc > def','\\> abc','    > abc'])('non-prefix greater-than use is not a quote marker: %s',source=>{
 expect(parseDocument(source).nodes.some(n=>n.kind==='markdown-marker'&&n.role==='blockquote')).toBe(false);
});
test('plain text mode and disabled Markdown recognition retain source punctuation',()=>{
 const source='> 因为 $x=1$';for(const opts of [{mode:'text' as const},{...options,recognizeMarkdownMarkers:false}])expect(convert(source,opts).document.nodes.some(n=>n.kind==='markdown-marker')).toBe(false);
});
test('Chinese word edits preserve quote and code-prefix descriptions',()=>{
 const source='> 因为 $x=1$\n> ```txt\n> 对应\n> ```',r=encodeDocument(source,options),start=source.indexOf('对应');expect(r.complete).toBe(true);
 for(const w of r.metadata.chineseWords)expect(source.slice(w.span.start,w.span.end)).toBe(w.raw);
 const edited=applyManualBraille(r,[{start,end:start+2,cells:'⠁⠃'}]);
 expect(edited.atoms.filter(a=>a.ruleId==='editorial-markdown-marker'||a.ruleId==='editorial-code-quote-prefix')).toEqual(r.atoms.filter(a=>a.ruleId==='editorial-markdown-marker'||a.ruleId==='editorial-code-quote-prefix'));
});
test('CRLF and empty quote lines retain source spans',()=>{
 const source='>\r\n>>\r\n> $x=1$',r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);expect(r.document.nodes.filter(n=>n.kind==='markdown-marker')).toHaveLength(3);
});
test('long nonrecursive quote prefixes stay bounded',()=>{
 const source='>'.repeat(10000)+' $x=1$',r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 const marker=r.document.nodes[0];expect(marker.kind).toBe('markdown-marker');if(marker.kind==='markdown-marker')expect(marker.level).toBe(10000);
});
