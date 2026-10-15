import {test,expect} from 'vitest';
import {analyzeChineseDetailed} from '../packages/core/src/language/chinese';
import {contextualWordReadings} from '../packages/core/src/language/contextual-readings';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const entries:[string,string[]][]=[
 ['空间',['kong1','jian1']],['时间',['shi2','jian1']],['变化',['bian4','hua4']],['区间',['qu1','jian1']],
 ['单位',['dan1','wei4']],['最大',['zui4','da4']],['同时',['tong2','shi2']],['指数',['zhi3','shu4']],
 ['重要',['zhong4','yao4']],['相似',['xiang1','si4']],['数值',['shu4','zhi2']],['实数',['shi2','shu4']],
 ['相等',['xiang1','deng3']],['体积',['ti3','ji1']],['整数',['zheng3','shu4']],['导数',['dao3','shu4']],
 ['次数',['ci4','shu4']],['减少',['jian3','shao3']],['总数',['zong3','shu4']],['至少',['zhi4','shao3']],
 ['分母',['fen1','mu3']],['相交',['xiang1','jiao1']],['复数',['fu4','shu4']],['倍数',['bei4','shu4']],
];
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
 const a=analyzeChineseDetailed('空间',[{start:0,end:2,readings:['kong4','jian4']}]);
 expect(a.words[0].syllables.map(s=>s.reading)).toEqual(['kong4','jian4']);expect(a.words[0].syllables.every(s=>s.source==='manual')).toBe(true);
});
test('custom providers do not inherit lexical promotion',()=>{
 const a=analyzeChineseDetailed('空间',[],0,()=>[{raw:'空',reading:'kong4',candidates:['kong1','kong4']},{raw:'间',reading:'jian4',candidates:['jian1','jian4']}]);
 expect(a.words[0].syllables.map(s=>s.reading)).toEqual(['kong4','jian4']);expect(a.diagnostics.some(d=>d.code==='CHINESE_POLYPHONY')).toBe(true);
});
test.each(['空间','区间','数值','实数'])('externally split %s retains character-level review',word=>{
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
 for(const source of [String.raw`\begin{aligned}\text{空间}&x=1\\\text{区间}&x^2=1\end{aligned}`,String.raw`\begin{tabular}{p{2cm}c}空间&$x^2$\\时间&$t=1$\end{tabular}`]) {
  const r=encodeDocument(source,{mode:'math',paragraphIndent:0});expect(r.complete).toBe(true);const start=source.indexOf('空间'),edited=applyManualBraille(r,[{start,end:start+2,cells:'⠁⠃'}]);
  expect(edited.document.source).toBe(source);expect(edited.atoms.some(a=>a.ruleId==='manual-braille')).toBe(true);
  expect(edited.atoms.filter(a=>a.kind==='cell'&&a.sourceRole==='structure')).toEqual(r.atoms.filter(a=>a.kind==='cell'&&a.sourceRole==='structure'));
 }
});
