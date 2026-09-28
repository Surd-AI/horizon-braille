import {test,expect} from 'vitest';
import {collectAmbiguities,resolveAmbiguities,convertWithResolutions} from '../packages/core/src/ambiguity';
import {braille} from '../packages/core/src/rules/math-symbols';
const cells=(e:ReturnType<typeof convertWithResolutions>,start:number)=>e.atoms.filter(a=>a.span.start>=start).map(a=>a.kind==='cell'?a.cells:'').join('');
test.each(['会议12:30:45','会议9：05：01'])('whole seconds clock %s has one decision and source-safe expansion',async source=>{
 const q=collectAmbiguities(source).filter(a=>a.kind==='colon');expect(q).toHaveLength(1);
 const r=await resolveAmbiguities(source);expect(r.resolutions.find(x=>x.id===q[0].id)?.choice).toBe('time');
 const e=convertWithResolutions(source,r,{chinese:{tones:'full'}});expect(e.diagnostics.some(d=>d.code==='ambiguity-time-normalized')).toBe(true);
 expect(e.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length&&a.span.start<=a.span.end)).toBe(true);
 expect(new Set(e.atoms.filter(a=>a.span.start>=2).map(a=>a.group)).size).toBe(1);
});
test.each(['时长（时分）25:30','耗时100:05:09','持续01:20:30'])('explicit duration %s is not a 24-hour clock',async source=>{
 const r=await resolveAmbiguities(source);expect(r.resolutions.some(x=>x.choice==='duration')).toBe(true);
 const e=convertWithResolutions(source,r);expect(e.diagnostics.some(d=>d.code==='ambiguity-duration-normalized')).toBe(true);
});
test.each(['会议24:00:00','会议12:30:60','会议12:30:45:20','时长1:99','耗时1:20.5','时长与比例1:20'])('invalid or conflicting %s is not expanded',async source=>{
 const e=convertWithResolutions(source,await resolveAmbiguities(source));expect(e.diagnostics.some(d=>/ambiguity-(?:time|duration)-normalized/.test(d.code))).toBe(false);
});
test.each(['比例3.5:-2:1','比例：-3:2.5','比例−3：+2'])('complete signed decimal ratio %s is one source-bound expression',async source=>{
 const qs=collectAmbiguities(source).filter(a=>a.kind==='colon'&&a.tokenSpan);expect(qs).toHaveLength(1);
 const e=convertWithResolutions(source,await resolveAmbiguities(source));expect(e.diagnostics.some(d=>d.code==='ambiguity-ratio-scope-unsupported')).toBe(false);
 expect(e.atoms.some(a=>a.group===`numeric-ratio:${qs[0].id}`)).toBe(true);
 expect(e.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
});
test('seconds clock retains full tones and correct second unit',async()=>{
 const source='会议1:02:03';const e=convertWithResolutions(source,await resolveAmbiguities(source),{chinese:{tones:'full'}});
 expect(cells(e,2)).toBe(braille(['3456','1','156','2','3456','245','12','124','356','1','3456','245','14','134','345','3']));
});
test('manual unknown overrides a clear duration and preserve prevents expansion',async()=>{
 const source='时长25:30',q=collectAmbiguities(source).find(a=>a.kind==='colon')!;
 const r=await resolveAmbiguities(source,{manual:{documentSource:source,resolutions:[{id:q.id,choice:'unknown',source:'manual'}]}});
 expect(convertWithResolutions(source,r).diagnostics.some(d=>d.code==='ambiguity-duration-normalized')).toBe(false);
 const normal=await resolveAmbiguities(source);expect(convertWithResolutions(source,normal,{timePolicy:'preserve'}).diagnostics.some(d=>d.code==='ambiguity-duration-normalized')).toBe(false);
});
test('two-field duration requires explicit units; minute-second duration has a separate choice',async()=>{
 for (const source of ['时长25:30','耗时12:30']) expect((await resolveAmbiguities(source)).resolutions.find(x=>x.id.includes('colon'))?.choice).toBe('unknown');
 const source='耗时（分秒）12:30',r=await resolveAmbiguities(source);
 expect(r.resolutions.some(x=>x.choice==='duration-ms')).toBe(true);
 const e=convertWithResolutions(source,r,{chinese:{tones:'full'}});
 expect(e.atoms.filter(a=>a.group?.startsWith('normalized-time:')).map(a=>a.kind==='cell'?a.cells:'').join('')).toBe(braille(['3456','1','12','124','356','1','3456','14','245','134','345','3']));
});


test.each([['船只','只','zhi1'],['艺术家','家','jia1']])('checked complete word %s supplies its verified reading',async(source,target,reading)=>{
 const r=await resolveAmbiguities(source);const q=r.ambiguities.find(a=>a.kind==='polyphone'&&source.slice(a.span.start,a.span.end)===target)!;
 expect(q).toBeDefined();expect(r.resolutions.find(x=>x.id===q.id)).toMatchObject({choice:reading,source:'heuristic'});
 const alternate=q.candidates.find(c=>c.id!=='unknown'&&c.id!==reading)!.id;
 const manual=await resolveAmbiguities(source,{manual:{documentSource:source,resolutions:[{id:q.id,choice:alternate,source:'manual'}]}});
 expect(manual.resolutions.find(x=>x.id===q.id)).toMatchObject({choice:alternate,source:'manual'});
 expect(convertWithResolutions(source,manual).metadata.chineseWords.flatMap(w=>w.syllables).find(s=>s.raw===target)?.reading).toBe(alternate);
});
