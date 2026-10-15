import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {braille as b} from '../packages/core/src/rules/math-symbols';
import {unicodeToBrf} from '../packages/core/src/codec';
const source=String.raw`\frac{\sin(2\pi - \alpha)\cos(\pi + \alpha)\cos(\frac{\pi}{2} + \alpha)\cos(\frac{11\pi}{2} - \alpha)}{\cos(\pi - \alpha)\sin(3\pi - \alpha)\sin(-\pi - \alpha)\sin(\frac{9\pi}{2} + \alpha)}`;
test.each([source,`$${source}$`,`\\[${source}\\]`])('long nested fraction wraps at 30 cells: %s',s=>{
 const e=encodeDocument(s);const r=convert(s,{columns:30,paragraphIndent:0});
 expect(r.document.source).toBe(s);expect(r.complete).toBe(true);
 expect(r.lines.length).toBeGreaterThan(1);expect(r.lines.every(l=>l.length<=30)).toBe(true);
 expect(r.brf).toBe(unicodeToBrf(r.unicode));
 for(let i=0;i<e.atoms.length;i++){const atom=e.atoms[i];if(atom.kind==='cell'){const maps=r.mappings.filter(m=>m.kind==='atom' && m.atomIndex===i);expect(maps.length).toBeGreaterThan(0);if(maps.some(m=>m.omittedAtWrap))expect(atom.cells).toMatch(/^⠀+$/);else expect(maps.reduce((n,m)=>n+m.length,0)).toBe(atom.cells.length);}}
});
test('two-level fraction uses a spaced main line and a numbered inner line from section 6.4.2.8',()=>{
 const r=convert(String.raw`\frac{a}{\frac{b}{c}}`,{columns:100,paragraphIndent:0});
 expect(r.unicode).toBe(b(['23','56','1','0','1256','0','56','12','0','1256','2','56','14','56']));
 expect(r.complete).toBe(true);
});
test('a numbered line before an opening fraction uses the separator from section 6.4.2.8',()=>{
 const r=convert(String.raw`\frac{a}{\frac{b}{\frac{c+d}{e}}}`,{columns:100,paragraphIndent:0});
 expect(r.complete).toBe(true);
 expect(r.unicode).toContain(b(['1256','2','6','23']));
 expect(r.unicode).toContain(b(['1256','23']));
});
test.each(['aligned','align','align*','alignedat','alignat','alignat*'])('%s alignment marks are not blank cells or unary operator boundaries',env=>{
 const count=env.includes('at')?'{2}':'';
 const s=String.raw`\begin{${env}}${count}a&=b+c\\x&=y\end{${env}}`;
 const r=convert(s,{columns:100,paragraphIndent:0});
 const a=convert('$a=b+c$',{columns:100,paragraphIndent:0});const x=convert('$x=y$',{columns:100,paragraphIndent:0});
 expect(r.document.source).toBe(s);expect(r.document.nodes.map(n=>n.kind)).toEqual(['bare-math']);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(a.unicode+b(['46','1256'])+x.unicode);
 const binary=convert(String.raw`\begin{${env}}${count}a&+b\end{${env}}`,{columns:100,paragraphIndent:0});
 expect(binary.unicode).toBe(convert('$a+b$',{columns:100,paragraphIndent:0}).unicode);
});
test('aligned optional position, row spacing and differing column counts retain mathematical content',()=>{
 const r=convert(String.raw`\begin{aligned}[t]a&=b\\[2pt]x=y\end{aligned}`,{columns:30,paragraphIndent:0});
 expect(r.complete).toBe(true);expect(r.diagnostics.some(d=>d.code==='math-ragged-matrix')).toBe(false);
});
test('alignment aliases reject broken endings and invalid pair counts',()=>{
 expect(convert(String.raw`\begin{align*}a&=b\end{aligned}`).complete).toBe(false);
 expect(convert(String.raw`\begin{alignedat}{0}a&=b\end{alignedat}`).complete).toBe(false);
});
