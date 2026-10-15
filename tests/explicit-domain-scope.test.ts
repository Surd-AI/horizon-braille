import {expect,test} from 'vitest';
import {convert} from '../packages/core/src/convert';
import {collectAmbiguities,resolveAmbiguities,convertWithResolutions} from '../packages/core/src/ambiguity';
const options={mode:'math' as const,paragraphIndent:0};
test.each([['$','$'],['$$','$$'],['\\(','\\)'],['\\[','\\]']])('explicit math strips sole %s wrapper syntax while retaining original spans',(open,close)=>{
 const inner=String.raw`\frac{1}{2}+x^2`,source=` ${open}${inner}${close} `,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(convert(inner,options).unicode);
 expect(r.document.source).toBe(source);expect(r.document.nodes.map(n=>n.raw).join('')).toBe(source);
 expect(r.atoms.every(a=>a.span.start>=source.indexOf(inner) && a.span.end<=source.indexOf(inner)+inner.length)).toBe(true);
});
test.each(['$$$$',String.raw`\( \)`,String.raw`$$\displaystyle$$`,String.raw`$$\text{}$$`])('empty wrapper in explicit math is incomplete and visible: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.unicode).toContain('⠿');expect(r.document.source).toBe(source);
});
test('explicit physical units retain their wrapper-adjusted source offset',()=>{
 const inner=String.raw`7.3\text{m}`,source=`$$${inner}$$`,r=convert(source,{mode:'physics',paragraphIndent:0});
 expect(r.complete).toBe(true);expect(r.unicode).toBe(convert(inner,{mode:'physics',paragraphIndent:0}).unicode);
 expect(r.atoms.every(a=>a.span.start>=2 && a.span.end<=source.length-2)).toBe(true);
});
test('explicit chemistry retains its wrapper-adjusted source offset',()=>{
 const inner=String.raw`\ce{H2O}`,source=`$$${inner}$$`,r=convert(source,{mode:'chemistry',paragraphIndent:0});
 expect(r.complete).toBe(true);expect(r.unicode).toBe(convert(inner,{mode:'chemistry',paragraphIndent:0}).unicode);
 expect(r.atoms.every(a=>a.span.start>=2 && a.span.end<=source.length-2)).toBe(true);
});
test.each([String.raw`F:A\to B`,'F:A\n\\to B',String.raw`$$F:A\xrightarrow{f}B$$`,String.raw`\begin{aligned}F:&A\to B\\G:&C\to D\end{aligned}`])('mapping decisions match the whole explicit mathematical scope: %s',async source=>{
 const questions=collectAmbiguities(source,options).filter(a=>a.kind==='colon');expect(questions.length).toBeGreaterThan(0);
 expect(questions.every(a=>a.mappingSyntax)).toBe(true);
 const set=await resolveAmbiguities(source,options),r=convertWithResolutions(source,set,options);
 expect(r.complete,JSON.stringify(r.diagnostics)).toBe(true);expect(r.document.source).toBe(source);
});
test('aligned definitions in a delimited document share the renderer row scope',async()=>{
 const source=String.raw`$\begin{aligned}F:&A\to B\\G:&C\to D\end{aligned}$`,set=await resolveAmbiguities(source);
 expect(set.ambiguities.filter(a=>a.kind==='colon').every(a=>a.mappingSyntax)).toBe(true);
 expect(convertWithResolutions(source,set).complete).toBe(true);
});
test('a wrapper inside unrelated content is not removed as a whole-domain wrapper',()=>{
 const source='a $x$ b',r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);
});
