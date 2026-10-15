import {test,expect} from 'vitest';
import {analyzeChineseDetailed} from '../packages/core/src/language/chinese';
import {contextualWordReadings} from '../packages/core/src/language/contextual-readings';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const entries:[string,string[]][]=[["速度",["su4","du4"]],["大小",["da4","xiao3"]],["中心",["zhong1","xin1"]],["功率",["gong1","lü4"]],["能量",["neng2","liang4"]],["降低",["jiang4","di1"]],["几何",["ji3","he2"]],["频率",["pin2","lü4"]],["常数",["chang2","shu4"]],["增长",["zeng1","zhang3"]],["求解",["qiu2","jie3"]],["内部",["nei4","bu4"]],["数列",["shu4","lie4"]],["乘法",["cheng2","fa3"]],["重心",["zhong4","xin1"]],["长方形",["chang2","fang1","xing2"]],["除数",["chu2","shu4"]],["速率",["su4","lü4"]],["调整",["tiao2","zheng3"]],["调节",["tiao2","jie2"]],["下降",["xia4","jiang4"]],["高度",["gao1","du4"]]];

test.each(entries)('complete word %s preserves candidates with its verified modern reading',(word,readings)=>{
 const a=analyzeChineseDetailed(word);expect(a.words).toHaveLength(1);expect(a.words[0].syllables.map(s=>s.reading)).toEqual(readings);
 expect(a.diagnostics.some(d=>d.code==='CHINESE_POLYPHONY')).toBe(false);expect(a.words[0].syllables.some(s=>s.candidates.length>1)).toBe(true);
 expect(convert(word,{mode:'text'}).complete).toBe(true);
});
test.each(entries)('word %s in a fraction retains its exact source offsets',(word,readings)=>{
 const source=`\\frac{\\text{${word}}}{x}`,r=convert(source,{mode:'math',paragraphIndent:0});
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);const w=r.metadata.chineseWords.find(w=>w.raw===word)!;
 expect(w.syllables.map(s=>s.reading)).toEqual(readings);expect(source.slice(w.span.start,w.span.end)).toBe(word);
});
test('manual pronunciation remains stronger than the whole-word table',()=>{
 const a=analyzeChineseDetailed('速度',[{start:0,end:2,readings:['su4','du2']}]);
 expect(a.words[0].syllables.map(s=>s.reading)).toEqual(['su4','du2']);expect(a.words[0].syllables.every(s=>s.source==='manual')).toBe(true);
});
test('custom providers do not inherit lexical promotion',()=>{
 const a=analyzeChineseDetailed('速度',[],0,()=>[{raw:'速',reading:'su4',candidates:['su4','su1']},{raw:'度',reading:'du2',candidates:['du4','du2']}]);
 expect(a.words[0].syllables.map(s=>s.reading)).toEqual(['su4','du2']);expect(a.diagnostics.some(d=>d.code==='CHINESE_POLYPHONY')).toBe(true);
});
test.each(['速度','区间','数值','实数'])('externally split %s retains character-level review',word=>{
 const a=analyzeChineseDetailed(word,[],0,undefined,[{start:0,end:1},{start:1,end:2}]);
 expect(a.words.map(w=>w.raw)).toEqual([...word]);expect(a.diagnostics.some(d=>d.code==='CHINESE_POLYPHONY')).toBe(true);
});
test.each(['空','间','区','数','结果','分数','倒数','分子'])('ambiguous %s is not promoted by a substring rule',word=>{
 expect(contextualWordReadings(word)).toBeUndefined();expect(analyzeChineseDetailed(word).diagnostics.some(d=>d.code==='CHINESE_POLYPHONY')).toBe(true);
});
test('an already unambiguous isolated character receives no new lexical promotion',()=>{
 expect(contextualWordReadings('导')).toBeUndefined();const a=analyzeChineseDetailed('导');
 expect(a.words[0].syllables[0].resolutionSource).toBeUndefined();expect(a.words[0].syllables[0].source).toBe('dictionary');
});
test('aligned prose, paragraph tables and manual braille edits preserve word identity',()=>{
 for(const source of [String.raw`\begin{aligned}\text{速度}&x=1\\\text{区间}&x^2=1\end{aligned}`,String.raw`\begin{tabular}{p{2cm}c}速度&$x^2$\\时间&$t=1$\end{tabular}`]) {
  const r=encodeDocument(source,{mode:'math',paragraphIndent:0});expect(r.complete).toBe(true);const start=source.indexOf('速度'),edited=applyManualBraille(r,[{start,end:start+2,cells:'⠁⠃'}]);
  expect(edited.document.source).toBe(source);expect(edited.atoms.some(a=>a.ruleId==='manual-braille')).toBe(true);
  expect(edited.atoms.filter(a=>a.kind==='cell'&&a.sourceRole==='structure')).toEqual(r.atoms.filter(a=>a.kind==='cell'&&a.sourceRole==='structure'));
 }
});

test.each(['度','率','中','降','调','大'])('isolated polyphonic %s remains reviewable',word=>{expect(contextualWordReadings(word)).toBeUndefined();expect(analyzeChineseDetailed(word).diagnostics.some(d=>d.code==='CHINESE_POLYPHONY')).toBe(true);});
