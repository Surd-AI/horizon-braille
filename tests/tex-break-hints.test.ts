import {test,expect} from 'vitest';
import {convert} from '../packages/core/src/convert';
const options={mode:'math' as const,paragraphIndent:0};
test.each(['nobreak','allowbreak'])('zero-width %s preserves neighboring math without an invented symbol',name=>{
 for(const [source,plain] of [[`x^2\\${name}+y`,'x^2+y'],[`\\frac{a\\${name}+b}{c}`,String.raw`\frac{a+b}{c}`],[`\\mathbf{a\\${name} b}`,String.raw`\mathbf{ab}`]]){
  const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);expect(r.unicode).toBe(convert(plain,options).unicode);
  const d=r.diagnostics.find(d=>d.code==='math-layout-hint-adapted')!;expect(source.slice(d.span.start,d.span.end)).toBe(`\\${name}`);
 }
});
test.each(['nobreak','allowbreak'])('document formula detection tolerates %s hints without changing source',name=>{
 for(const source of [`x^2\\${name}+y`,`\\${name} x^2+y`,`$\\frac{a\\${name}+b}{c}$`]){
  const r=convert(source,{mode:'document',paragraphIndent:0});expect(r.complete,JSON.stringify(r.diagnostics)).toBe(true);expect(r.document.source).toBe(source);
  expect(r.diagnostics.some(d=>d.code==='math-layout-hint-adapted')).toBe(true);
 }
});
test.each(['nobreak','allowbreak'])('hint-only %s input retains visible original text for correction',name=>{
 const source=`\\${name}`,r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toMatch(/[^\u2800\s]/);
 expect(r.diagnostics.some(d=>d.code==='math-empty-expression')).toBe(true);
});
test('hint-like command prefixes remain unknown rather than being partially consumed',()=>{
 const source=String.raw`x+\nobreakfoo{y}`;expect(convert(source,options).complete).toBe(false);expect(convert(source,options).document.source).toBe(source);
});
test('repeated hints do not consume a semantic nesting budget during recognition',()=>{
 const source=String.raw`\allowbreak `.repeat(100)+'x^2+y',r=convert(source,{mode:'document',paragraphIndent:0});
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);expect(r.diagnostics.filter(d=>d.code==='math-layout-hint-adapted')).toHaveLength(100);
});
