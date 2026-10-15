import {expect,test} from 'vitest';
import {convert} from '../packages/core/src/convert';
import {braille} from '../packages/core/src/rules/math-symbols';

const letters='abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz';
test.each([`x^{${letters}}`,`x_{${letters}}`,`x_{${letters}}^{${letters}}`,String.raw`\sum_{${letters}}^{${letters}} x`,String.raw`\int_{${letters}}^{${letters}} x`,String.raw`\log_{${letters}}^{${letters}} x`,String.raw`x^{\frac{${letters}}{2}}`])('long index continues without dropping cells or changing math scope: %s',source=>{
 const options={mode:'math' as const,paragraphIndent:0},wide=convert(source,{...options,columns:500});
 const narrow=convert(source,{...options,columns:12});
 expect(wide.complete).toBe(true);expect(narrow.complete).toBe(true);
 expect(narrow.preview).toBeUndefined();expect(narrow.lines.length).toBeGreaterThan(1);
 expect(narrow.lines.every(line=>line.length<=12)).toBe(true);
 expect(narrow.atoms).toEqual(wide.atoms);expect(narrow.document.source).toBe(source);
 expect(narrow.mappings.filter(m=>m.kind==='continuation').length).toBeGreaterThan(0);
 expect(narrow.lines.slice(0,-1).every(line=>line.endsWith(braille(['6'])))).toBe(true);
 const groups=new Map<string,Set<number>>();
 narrow.mappings.forEach(m=>{if(m.atomIndex===null)return;const group=narrow.atoms[m.atomIndex].group;const rows=groups.get(group)??new Set();rows.add(m.line);groups.set(group,rows);});
 expect([...groups.values()].every(rows=>rows.size===1)).toBe(true);
});
test('nested root and index endings stay attached to their payload',()=>{
 const source=String.raw`x^{\sqrt{${letters}}}`;
 const r=convert(source,{mode:'math',columns:12,paragraphIndent:0});
 expect(r.complete).toBe(true);expect(r.lines.at(-1)?.endsWith(braille(['1456','156']))).toBe(true);
});
test('short exponent notation retains its original cells',()=>{
 const r=convert('x^2+y_3',{mode:'math',paragraphIndent:0});
 expect(r.complete).toBe(true);expect(r.unicode).toBe(braille(['56','1346','34','23','0','235','56','13456','16','25']));
});
test.each(['overline','bar','underline','widehat','widetilde'])('long %s body keeps its grouping and complete mark when wrapping',name=>{
 const source=`\\${name}{${letters}}`,options={mode:'math' as const,paragraphIndent:0};
 const wide=convert(source,{...options,columns:500}),r=convert(source,{...options,columns:12});
 expect(r.complete).toBe(true);expect(r.atoms).toEqual(wide.atoms);
 expect(r.lines.length).toBeGreaterThan(1);expect(r.lines.every(line=>line.length<=12)).toBe(true);
 expect(r.lines[0].startsWith(braille(['12346','56','1']))).toBe(true);
 expect(r.lines.slice(0,-1).every(line=>line.endsWith(braille(['6'])))).toBe(true);
 const direction=name==='underline'?'56':'45',mark=name==='widehat'?'256':name==='widetilde'?'26':'25';
 expect(r.lines.at(-1)?.endsWith(braille(['1356','13456',direction,mark,'156']))).toBe(true);
 expect(r.document.source).toBe(source);
});
