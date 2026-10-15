import {test,expect} from 'vitest';
import {analyzeChineseDetailed} from '../packages/core/src/language/chinese';
import {convert} from '../packages/core/src/convert';
import {resolveAmbiguities,convertWithResolutions} from '../packages/core/src/ambiguity';
import {reflowExistingAtoms} from '../packages/core/src/convert';
const entries:[string,string[]][]=[['对应',['dui4','ying4']],['条件',['tiao2','jian4']],['关系',['guan1','xi4']],['不同',['bu4','tong2']],['过程',['guo4','cheng2']],['分析',['fen1','xi1']],['向量',['xiang4','liang4']],['相同',['xiang1','tong2']]];
test.each(entries)('complete lexical %s retains checked readings and candidate alternatives',(word,readings)=>{
 const a=analyzeChineseDetailed(word);expect(a.words).toHaveLength(1);expect(a.words[0].syllables.map(s=>s.reading)).toEqual(readings);
 expect(a.diagnostics.some(d=>d.code==='CHINESE_POLYPHONY')).toBe(false);expect(a.words[0].syllables.some(s=>s.candidates.length>1)).toBe(true);
 expect(convert(word,{mode:'text',paragraphIndent:0}).complete).toBe(true);
});
test.each(['应','量','分','结果'])('isolated or meaning-dependent %s remains for review',word=>{
 expect(analyzeChineseDetailed(word).diagnostics.some(d=>d.code==='CHINESE_POLYPHONY')).toBe(true);
});
test.each(['对应','条件','关系','过程','分析','向量'])('externally split %s is not joined or inferred',word=>{
 const a=analyzeChineseDetailed(word,[],0,undefined,[{start:0,end:1},{start:1,end:2}]);
 expect(a.words.map(w=>w.raw)).toEqual([...word]);expect(a.diagnostics.some(d=>d.code==='CHINESE_POLYPHONY')).toBe(true);
});
test('manual pronunciation remains stronger than a complete-word default',()=>{
 const a=analyzeChineseDetailed('向量',[{start:0,end:2,readings:['xiang4','liang2']}]);
 expect(a.words[0].syllables.map(s=>s.reading)).toEqual(['xiang4','liang2']);expect(a.words[0].syllables.every(s=>s.source==='manual')).toBe(true);
});
test('custom reading providers remain independent of the default table',()=>{
 const a=analyzeChineseDetailed('向量',[],0,text=>[...text].map((raw,i)=>({raw,reading:i?'liang2':'xiang4',candidates:i?['liang2','liang4']:['xiang4']})));
 expect(a.words[0].syllables[1].reading).toBe('liang2');expect(a.diagnostics.some(d=>d.code==='CHINESE_POLYPHONY')).toBe(true);
});
test('aligned words retain complete fields and exact source offsets',()=>{
 const source=String.raw`\begin{aligned}\text{对应}&a=b\\\text{条件}&x>0\\\text{关系}&y=2\\\text{向量}&A=B\end{aligned}`,r=convert(source,{mode:'math',paragraphIndent:0});
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 for(const w of r.metadata.chineseWords)expect(source.slice(w.span.start,w.span.end)).toBe(w.raw);
});
test('local semantic decisions and direct conversion agree on fixed words',async()=>{
 const source=String.raw`\text{向量}A=\text{对应}B`,options={mode:'math' as const,paragraphIndent:0};
 const direct=convert(source,options),decisions=await resolveAmbiguities(source,options),encoded=convertWithResolutions(source,decisions,options);
 expect(direct.complete).toBe(true);expect(reflowExistingAtoms(encoded,options).unicode).toBe(direct.unicode);
});
