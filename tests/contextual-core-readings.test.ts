import {expect,test} from 'vitest';
import {convert} from '../packages/core/src/convert';
import {analyzeChineseDetailed} from '../packages/core/src/language/chinese';
import {collectAmbiguities,convertWithResolutions,resolveAmbiguities} from '../packages/core/src/ambiguity';
import {reflowExistingAtoms} from '../packages/core/src/convert';

test.each([['银行',['yin2','hang2']],['阅读',['yue4','du2']],['船只',['chuan2','zhi1']],['概率',['gai4','lü4']],['函数',['han2','shu4']],['集合',['ji2','he2']],['因为',['yin1','wei4']],['未知',['wei4','zhi1']],['盲文',['mang2','wen2']]])('direct core accepts the exact complete-word reading for %s',(source,readings)=>{
 const r=convert(source,{paragraphIndent:0});
 expect(r.complete).toBe(true);
 expect(r.metadata.chineseWords.flatMap(w=>w.syllables.map(s=>s.reading))).toEqual(readings);
 expect(r.diagnostics.some(d=>d.code==='CHINESE_POLYPHONY')).toBe(false);
 if(source!=='盲文') expect(r.metadata.chineseWords.some(w=>w.syllables.some(s=>s.resolutionSource==='heuristic'))).toBe(true);
});
test('the independently checked repeated curved word corrects the final qu3 dictionary proposal',()=>{
 const r=convert('弯弯曲曲',{paragraphIndent:0});
 expect(r.complete).toBe(true);expect(r.metadata.chineseWords.flatMap(w=>w.syllables.map(s=>s.reading))).toEqual(['wan1','wan1','qu1','qu1']);
 expect(r.metadata.chineseWords[0].syllables[3].candidates).toContain('qu3');
});
test.each(['行','知','为','数','银，行'])('unknown or incomplete word context remains unresolved: %s',source=>{
 expect(convert(source,{paragraphIndent:0}).diagnostics.some(d=>d.code==='CHINESE_POLYPHONY')).toBe(true);
});
test('an externally split word is not recovered by substring matching',()=>{
 const r=convert('银行',{wordBoundaries:[{start:0,end:1},{start:1,end:2}],paragraphIndent:0});
 expect(r.complete).toBe(false);expect(r.diagnostics.some(d=>d.code==='CHINESE_POLYPHONY')).toBe(true);
});
test('custom reading providers are not silently promoted through the default dictionary',()=>{
 const r=analyzeChineseDetailed('银行',[],0,raw=>[...raw].map(c=>({raw:c,reading:c==='银'?'yin2':'xing2',candidates:c==='银'?['yin2']:['xing2','hang2']})));
 expect(r.words.flatMap(w=>w.syllables.map(s=>s.reading))).toEqual(['yin2','xing2']);
 expect(r.diagnostics.some(d=>d.code==='CHINESE_POLYPHONY')).toBe(true);
});
test('manual pronunciation and manual decisions remain stronger than local lexical readings',()=>{
 const source='银行';
 const r=convert(source,{overrides:[{start:0,end:2,readings:['yin2','xing2']}],paragraphIndent:0});
 expect(r.metadata.chineseWords[0].syllables[1]).toMatchObject({reading:'xing2',source:'manual'});
 const a=collectAmbiguities(source).find(a=>a.span.start===1)!;
 const encoded=convertWithResolutions(source,{documentSource:source,resolutions:[{id:a.id,choice:'xing2',source:'manual'}]});
 expect(encoded.metadata.chineseWords[0].syllables[1]).toMatchObject({reading:'xing2',resolutionSource:'manual'});
});
test('direct core and the local semantic pipeline agree on checked terms',async()=>{
 const source=String.raw`\begin{aligned}\text{因为}&x>0\\\text{函数}&f(x)=x^2\end{aligned}`,options={mode:'math' as const,paragraphIndent:0};
 const direct=convert(source,options),decisions=await resolveAmbiguities(source,options),encoded=convertWithResolutions(source,decisions,options);
 expect(direct.complete).toBe(true);expect(reflowExistingAtoms(encoded,options).unicode).toBe(direct.unicode);
 expect(direct.metadata.chineseWords.every(w=>source.slice(w.span.start,w.span.end)===w.raw)).toBe(true);
});
