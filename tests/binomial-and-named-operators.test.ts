import {expect, test} from 'vitest';
import {convert} from '../packages/core/src/convert';
import {braille} from '../packages/core/src/rules/math-symbols';

test.each(['binom','dbinom','tbinom'])('%s maps total below and selection above without reversing arguments',name=>{
 const source=`\\${name}{n}{k}`,r=convert(source,{mode:'math',paragraphIndent:0});
 expect(r.complete).toBe(true);
 expect(r.unicode).toBe(braille(['6','14','16','56','1345','156','34','56','13','156']));
 expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='math-binomial-normalized' && d.severity==='info')).toBe(true);
 expect(convert(source,{paragraphIndent:0}).unicode).toBe(r.unicode);
});
test('compound binomial arguments retain scope and nested formulas',()=>{
 const options={mode:'math' as const,paragraphIndent:0,columns:100};
 const source=String.raw`\binom{n+1}{\frac{k}{2}}`;
 const r=convert(source,options);
 expect(r.complete).toBe(true);
 expect(r.unicode).toBe(convert(String.raw`C_{n+1}^{\frac{k}{2}}`,options).unicode);
 expect(r.atoms.every(a=>a.span.start>=0 && a.span.end<=source.length)).toBe(true);
});
test('outside power applies to the complete binomial coefficient',()=>{
 const options={mode:'math' as const,paragraphIndent:0,columns:100};
 const r=convert(String.raw`\binom{n}{k}^2`,options);
 expect(r.complete).toBe(true);
 expect(r.unicode).toBe(convert(String.raw`(C_n^k)^2`,options).unicode);
 expect(convert(String.raw`\binom{n}{k}^2`,{paragraphIndent:0,columns:100}).unicode).toBe(r.unicode);
});
test.each([String.raw`\binom{n}`,String.raw`\binom{}{k}`,String.raw`\binom{n}{}`])('incomplete binomial stays visible: %s',source=>{
 const r=convert(source,{mode:'math'});expect(r.complete).toBe(false);
 expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
test.each(['deg','dim','hom','ker','Pr','gcd'])('standard named command %s agrees with explicitly named operator',name=>{
 const options={mode:'math' as const,paragraphIndent:0},source=`\\${name}(x)`;
 const r=convert(source,options);expect(r.complete).toBe(true);
 expect(r.unicode).toBe(convert(`\\operatorname{${name}}(x)`,options).unicode);
 expect(convert(source,{paragraphIndent:0}).unicode).toBe(r.unicode);
});
test.each([['iff','Longleftrightarrow'],['implies','Longrightarrow']])('logical command %s retains checked arrow cells',(name,canonical)=>{
 const options={mode:'math' as const,paragraphIndent:0},source=`x\\${name} y`;
 const r=convert(source,options);expect(r.complete).toBe(true);
 expect(r.unicode).toBe(convert(`x\\${canonical} y`,options).unicode);
 expect(convert(source,{paragraphIndent:0}).unicode).toBe(r.unicode);
});
test.each(['biggl','biggr','Biggl','Biggr','bigm','Bigm','biggm','Biggm'])('sizing %s preserves delimiter payload',name=>{
 const options={mode:'math' as const,paragraphIndent:0};
 const r=convert(`\\${name}(x)`,options);expect(r.complete).toBe(true);
 expect(r.unicode).toBe(convert('(x)',options).unicode);
});
test.each([['bigl','bigr'],['Bigl','Bigr'],['biggl','biggr'],['Biggl','Biggr']])('paired %s/%s delimiters are recognized in a mixed document',(left,right)=>{
 const source=`\\${left}(x+1\\${right})`;
 const r=convert(source,{paragraphIndent:0});expect(r.complete).toBe(true);
 expect(r.unicode).toBe(convert('(x+1)',{mode:'math',paragraphIndent:0}).unicode);
 expect(r.document.source).toBe(source);
});
test('unknown macro is still unresolved and supported operator names do not capture prose',()=>{
 expect(convert(String.raw`\invented(x)`,{mode:'math'}).complete).toBe(false);
 expect(convert('dimension',{paragraphIndent:0}).document.nodes.every(n=>n.kind==='text')).toBe(true);
});
