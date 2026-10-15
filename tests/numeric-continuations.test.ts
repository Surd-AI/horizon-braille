import {expect,test} from 'vitest';
import {convert} from '../packages/core/src/convert';
import {braille} from '../packages/core/src/rules/math-symbols';
const digits='1234567890123456789012345678901234567890';
test.each([digits,`-${digits}`,`${digits}.1234567890`,`x^{${digits}}`,`x_{-${digits}}`,String.raw`\sum_{${digits}}^{${digits}} x`,String.raw`\sqrt{${digits}}`,String.raw`\sqrt[${digits}]{x}`,String.raw`\frac{${digits}}{${digits}}`])('long numeral retains exact cells and can continue: %s',source=>{
 const options={mode:'math' as const,paragraphIndent:0};
 const wide=convert(source,{...options,columns:500}),narrow=convert(source,{...options,columns:12});
 expect(wide.complete).toBe(true);expect(narrow.complete).toBe(true);
 expect(narrow.atoms).toEqual(wide.atoms);expect(narrow.document.source).toBe(source);
 expect(narrow.lines.length).toBeGreaterThan(1);expect(narrow.lines.every(l=>l.length<=12)).toBe(true);
 expect(narrow.lines.slice(0,-1).every(l=>l.endsWith(braille(['6'])))).toBe(true);
 const groups=new Map<string,Set<number>>();
 for(const m of narrow.mappings){if(m.atomIndex===null)continue;const key=narrow.atoms[m.atomIndex].group;const rows=groups.get(key)??new Set();rows.add(m.line);groups.set(key,rows);}
 expect([...groups.values()].every(rows=>rows.size===1)).toBe(true);
 expect(narrow.mappings.every(m=>m.span.start>=0 && m.span.end<=source.length)).toBe(true);
});
test('small numerals and simple fractions keep the existing exact encoding',()=>{
 const options={mode:'math' as const,paragraphIndent:0};
 expect(convert('12.3',options).unicode).toBe(braille(['3456','1','12','2','14']));
 expect(convert('x^{-12}',options).unicode).toBe(braille(['56','1346','34','36','2','23']));
 expect(convert(String.raw`\frac{12}{34}`,options).unicode).toBe(braille(['3456','1','12','25','256']));
});
test('the numeric indicator remains attached to the first actual digit',()=>{
 const r=convert('1234',{mode:'math',paragraphIndent:0,columns:3});
 expect(r.complete).toBe(true);expect(r.lines[0]).toBe(braille(['3456','1','6']));
});
