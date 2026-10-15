import {test,expect} from 'vitest';
import {analyzeChineseDetailed} from '../packages/core/src/language/chinese';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const entries:[string,string[]][]=[
 ['数量',['shu4','liang4']],['选择',['xuan3','ze2']],['解析',['jie3','xi1']],
 ['所有',['suo3','you3']],['主要',['zhu3','yao4']],['曲线',['qu1','xian4']],
 ['数学',['shu4','xue2']],['任意',['ren4','yi4']],['是否',['shi4','fou3']],
 ['必要',['bi4','yao4']],['答案',['da2','an4']],['平行',['ping2','xing2']],
 ['角度',['jiao3','du4']],['不等式',['bu4','deng3','shi4']],['三角形',['san1','jiao3','xing2']],
 ['种类',['zhong3','lei4']],['负数',['fu4','shu4']],['解答',['jie3','da2']],
 ['化学',['hua4','xue2']],['有理数',['you3','li3','shu4']],['充分',['chong1','fen4']],
];
test.each(entries)('whole lexical word %s retains its verified reading',(word,readings)=>{
 const a=analyzeChineseDetailed(word);expect(a.words).toHaveLength(1);
 expect(a.words[0].syllables.map(s=>s.reading)).toEqual(readings);
 expect(a.diagnostics.some(d=>d.code==='CHINESE_POLYPHONY')).toBe(false);
 expect(convert(word,{mode:'text'}).complete).toBe(true);
});
test.each(entries)('literal math field preserves lexical word %s and offsets',(word,readings)=>{
 const source=`\\frac{\\text{${word}}}{x}`,r=convert(source,{mode:'math',paragraphIndent:0});
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 const w=r.metadata.chineseWords.find(w=>w.raw===word);expect(w).toBeDefined();
 expect(source.slice(w!.span.start,w!.span.end)).toBe(word);expect(w!.syllables.map(s=>s.reading)).toEqual(readings);
});
test('manual pronunciation remains stronger than the complete-word rule',()=>{
 const a=analyzeChineseDetailed('平行',[{start:0,end:2,readings:['ping2','hang2']}]);
 expect(a.words[0].syllables.map(s=>s.reading)).toEqual(['ping2','hang2']);expect(a.words[0].syllables.every(s=>s.source==='manual')).toBe(true);
});
test('custom reading providers retain review rather than receiving lexical promotion',()=>{
 const a=analyzeChineseDetailed('平行',[],0,text=>[...text].map((raw,i)=>({raw,reading:i?'hang2':'ping2',candidates:i?['hang2','xing2']:['ping2']})));
 expect(a.words[0].syllables[1].reading).toBe('hang2');expect(a.diagnostics.some(d=>d.code==='CHINESE_POLYPHONY')).toBe(true);
});
test.each(['数量','平行','数学','解析'])('externally split %s does not gain a whole-word reading',word=>{
 const a=analyzeChineseDetailed(word,[],0,undefined,[{start:0,end:1},{start:1,end:2}]);
 expect(a.words.map(w=>w.raw)).toEqual([...word]);expect(a.diagnostics.some(d=>d.code==='CHINESE_POLYPHONY')).toBe(true);
});
test.each(['结果','部分','知识','分数','数','解','行'])('meaning-dependent or unverified %s still requires review',word=>{
 expect(analyzeChineseDetailed(word).diagnostics.some(d=>d.code==='CHINESE_POLYPHONY')).toBe(true);
});
test('aligned mixed Chinese words retain source fields and manual braille edits',()=>{
 const source=String.raw`\begin{aligned}\text{解析}&x=1\\\text{答案}&x^2=1\end{aligned}`,r=encodeDocument(source,{mode:'math',paragraphIndent:0});
 expect(r.complete).toBe(true);const word=r.metadata.chineseWords.find(w=>w.raw==='答案')!;
 const edit=applyManualBraille(r,[{...word.span,cells:'⠁⠃'}]);expect(edit.atoms.some(a=>a.ruleId==='manual-braille')).toBe(true);
 expect(edit.document.source).toBe(source);expect(r.metadata.chineseWords.find(w=>w.raw==='解析')!.syllables.map(s=>s.reading)).toEqual(['jie3','xi1']);
});
