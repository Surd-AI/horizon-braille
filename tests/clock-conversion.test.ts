import { expect, test } from 'vitest';
import { collectAmbiguities, convertWithResolutions, resolveAmbiguities } from '../packages/core/src/ambiguity';
import { reflowExistingAtoms } from '../packages/core/src/convert';
import { braille } from '../packages/core/src/rules/math-symbols';

// Editorial expansion: 12时30分. Digits GB/T18028 §5.1; shi2/fen1 GF0019 §9.
// This is deliberately not presented as a dedicated clock-colon standard rule.
const fullClock = braille(['3456','1','12','156','2','3456','14','245','124','356','1']);
test.each(['比例3:2','比例3：2'])('numeric ratio %s has no prose-symbol marker or internal blanks',async(source)=>{
 const e=convertWithResolutions(source,await resolveAmbiguities(source));
 expect(e.atoms.filter(a=>a.span.start>=2).map(a=>a.kind==='cell'?a.cells:'').join('')).toBe(braille(['3456','14','5','25','3456','12']));
});
test('ratio labels do not block the complete following numeric expression',async()=>{
 const source='比例：3:2',e=convertWithResolutions(source,await resolveAmbiguities(source));
 expect(e.diagnostics.some(d=>d.code==='ambiguity-ratio-scope-unsupported')).toBe(false);
 expect(e.atoms.filter(a=>a.span.start>=3&&a.span.end>3).map(a=>a.kind==='cell'?a.cells:'').join('')).toBe(braille(['3456','14','5','25','3456','12']));
});
test.each(['比例3..5:2','比例3:2:'])('never rewrites a partial numeric token in %s',async(source)=>{
 const e=convertWithResolutions(source,await resolveAmbiguities(source));
 expect(e.complete).toBe(false);
 expect(e.diagnostics.some(d=>d.code==='ambiguity-ratio-scope-unsupported')).toBe(true);
});
test('confirmed prose clock defaults to an exact hours/minutes expansion', async () => {
 const source='会议12:30开始';
 const r=await resolveAmbiguities(source);
 const e=convertWithResolutions(source,r,{chinese:{tones:'full'}});
 const atoms=e.atoms.filter(a=>a.span.start>=2&&a.span.end<=7);
 expect(atoms.map(a=>a.kind==='cell'?a.cells:'').join('')).toBe(fullClock);
 expect(e.document.source).toBe(source);
 expect(e.diagnostics.some(d=>d.code==='ambiguity-time-unsupported')).toBe(false);
 expect(e.diagnostics.some(d=>d.code==='ambiguity-time-normalized')).toBe(true);
 expect(new Set(atoms.map(a=>a.group)).size).toBe(1);
 expect(atoms.find(a=>a.span.start===7&&a.span.end===7)).toBeDefined();
 const laid=reflowExistingAtoms(e,{columns:15,paragraphIndent:0});
 expect(laid.lines.some(l=>l.includes(fullClock))).toBe(true);
 expect(laid.diagnostics.some(d=>d.code==='layout-unbreakable-overflow')).toBe(false);
});
test('expanded units inherit full tones and normative tone omission',async()=>{
 const source='会议12:30',r=await resolveAmbiguities(source);
 const full=convertWithResolutions(source,r,{timePolicy:'normalize-hours-minutes',chinese:{tones:'full'}});
 const normal=convertWithResolutions(source,r,{chinese:{tones:'normative'}});
 const cells=(e:typeof full)=>e.atoms.filter(a=>a.span.start>=2).map(a=>a.kind==='cell'?a.cells:'').join('');
 expect(cells(full)).toBe(fullClock);
 expect(cells(normal)).toBe(fullClock.slice(0,-1));
});
test.each(['会议00:00','会议23：59','会议9:05'])('whole valid clock %s gets one source-bound group',async(source)=>{
 const e=convertWithResolutions(source,await resolveAmbiguities(source));
 expect(e.diagnostics.some(d=>d.code==='ambiguity-time-normalized')).toBe(true);
 expect(e.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
});
test.each(['会议24:00','会议12:60','会议12:30:99','会议12:30.5','比分3:2','时长12:30'])('does not normalize unsupported/non-clock %s',async(source)=>{
 const e=convertWithResolutions(source,await resolveAmbiguities(source));
 expect(e.diagnostics.some(d=>d.code==='ambiguity-time-normalized')).toBe(false);
});
test('explicit preserve and manual ratio remain authoritative',async()=>{
 const source='会议12:30',r=await resolveAmbiguities(source);
 expect(convertWithResolutions(source,r,{timePolicy:'preserve'}).diagnostics.some(d=>d.code==='ambiguity-time-unsupported')).toBe(true);
 const q=collectAmbiguities(source).find(a=>a.kind==='colon')!;
 const manual=await resolveAmbiguities(source,{manual:{documentSource:source,resolutions:[{id:q.id,choice:'ratio',source:'manual'}]}});
 expect(convertWithResolutions(source,manual).diagnostics.some(d=>d.code==='ambiguity-time-normalized')).toBe(false);
});
test('whole bank notice matches independently specified full-tone cells',async()=>{
 const source='银行发通知：会议12:30开始，比例3:2';
 // Full-tone spelling, prose colon 36/comma 5, expanded clock, numeric ratio.
 const expected=braille([
  '126','2','125','236','2','0', // 银行
  '124','35','1','0', // 发
  '2345','256','1','34','1','36','0', // 通知：
  '125','2456','23','24','23', // 会议
  '3456','1','12','156','2','3456','14','245','124','356','1', // 12时30分
  '13','246','1','156','3','5','0', // 开始，
  '12','24','3','123','24','23', // 比例
  '3456','14','5','25','3456','12', // 3:2
 ]);
 const e=convertWithResolutions(source,await resolveAmbiguities(source),{chinese:{tones:'full'}});
 expect(e.complete).toBe(true);
 expect(e.atoms.map(a=>a.kind==='cell'?a.cells:'').join('')).toBe(expected);
 expect(e.diagnostics.filter(d=>d.severity!=='info')).toEqual([]);
 const narrow=reflowExistingAtoms(e,{columns:20,paragraphIndent:2});
 const wide=reflowExistingAtoms(e,{columns:60,paragraphIndent:0});
 expect(narrow.complete).toBe(true);expect(wide.complete).toBe(true);
 expect(narrow.lines.some(l=>l.includes(fullClock))).toBe(true);
 expect(wide.lines.join('')).toBe(expected);
});
