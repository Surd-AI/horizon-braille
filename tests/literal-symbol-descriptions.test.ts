import {test,expect} from 'vitest';
import {convert} from '../packages/core/src/convert';

test.each(['_','#','&','\\','$','•'])('literal %s stays readable and source-bound',glyph=>{
 const r=convert(`abc${glyph}def`,{mode:'text',paragraphIndent:0});
 expect(r.complete).toBe(true);expect(r.unhandled).toEqual([]);expect(r.document.source).toBe(`abc${glyph}def`);
 expect(r.diagnostics.some(d=>d.code==='text-symbol-described')).toBe(true);
 expect(r.metadata.chineseWords.some(w=>w.raw.includes('号'))).toBe(false);
 expect(r.atoms.filter(a=>a.kind==='cell' && a.ruleId==='editorial-text-symbol-description').every(a=>a.span.start===3 && a.span.end===4)).toBe(true);
});
test('mathematical syntax and unknown commands retain their own interpretation',()=>{
 expect(convert(String.raw`x_1`,{mode:'math'}).complete).toBe(true);
 expect(convert(String.raw`\text{\unknown}`,{mode:'math'}).complete).toBe(false);
});
