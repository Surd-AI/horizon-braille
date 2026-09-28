import {test,expect} from 'vitest';
import {parseMath} from '../packages/core/src/parser/math';
import {encodeMath} from '../packages/core/src/rules/math';
import {braille} from '../packages/core/src/rules/math-symbols';
import {convertWithResolutions,resolveAmbiguities} from '../packages/core/src/ambiguity';
const encoded=(s:string)=>encodeMath(parseMath(s));
const cells=(r:ReturnType<typeof encoded>)=>r.atoms.map(a=>a.cells).join('');
test.each(['F:A→B',String.raw`F:A\to B`,String.raw`F:A\rightarrow B`])('mapping %s follows official §6.18.2 example8',s=>{
 const r=encoded(s);expect(r.complete).toBe(true);
 expect(cells(r)).toBe(braille(['6','124','36','0','6','1','0','25','135','6','12']));
});
test('explicit math mapping choice is applied while unrelated type colon stays pending',async()=>{
 const source=String.raw`$f:A\to B$`,r=await resolveAmbiguities(source);
 expect(r.resolutions.some(r=>r.choice==='mapping')).toBe(true);
 expect(convertWithResolutions(source,r).diagnostics.some(d=>d.code==='ambiguity-mapping-unsupported')).toBe(false);
 const other='x:Type';expect((await resolveAmbiguities(other)).resolutions.some(r=>r.choice==='mapping')).toBe(false);
});
test('gathered is a checked linear multiline adapter, not a matrix',()=>{
 const r=encoded(String.raw`\begin{gathered}a=1\\b=2\end{gathered}`);
 expect(r.complete).toBe(true);expect(cells(r)).toContain(braille(['46','1256']));
 expect(r.atoms.some(a=>a.rowSeparator)).toBe(false);
});
test('mathematical slash/minus stay explicit and paths are not rewritten',async()=>{
 expect(cells(encoded('-3-2'))).toBe(braille(['36','3456','14','0','36','3456','12']));
 expect(cells(encoded('a/b'))).toBe(braille(['56','1','6','1256','56','12']));
 const source='路径 /home/user/a-b.txt';const e=convertWithResolutions(source,await resolveAmbiguities(source));
 expect(e.document.source).toBe(source);expect(e.diagnostics.some(d=>d.code==='ambiguity-time-normalized')).toBe(false);
});
test('manual unknown does not adopt checked mapping spelling',async()=>{
 const source=String.raw`$f:A\to B$`;
 const initial=await resolveAmbiguities(source),q=initial.ambiguities.find(a=>a.kind==='colon')!;
 const manual=await resolveAmbiguities(source,{manual:{documentSource:source,resolutions:[{id:q.id,choice:'unknown',source:'manual'}]}});
 const result=convertWithResolutions(source,manual);
 expect(result.complete).toBe(false);
 expect(result.atoms.filter(a=>a.span.start===q.span.start).some(a=>a.kind==='cell'&&a.cells===braille(['36']))).toBe(false);
});
test('gathered rejects alignment columns and mapping excludes general type annotations',()=>{
 expect(encoded(String.raw`\begin{gathered}a&=1\\b&=2\end{gathered}`).diagnostics.some(d=>d.code==='math-gathered-columns-unsupported')).toBe(true);
 const r=encoded(String.raw`f:AB\to C`);
 expect(r.atoms.filter(a=>a.span.start===1).some(a=>a.cells===braille(['36']))).toBe(false);
});
