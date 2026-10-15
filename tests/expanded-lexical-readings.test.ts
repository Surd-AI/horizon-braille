import {test,expect} from 'vitest';
import {analyzeChineseDetailed} from '../packages/core/src/language/chinese';
import {convert} from '../packages/core/src/convert';
const entries:[string,string[]][]=[['其中',['qi2','zhong1']],['分别',['fen1','bie2']],['进行',['jin4','xing2']],['系数',['xi4','shu4']],['得到',['de2','dao4']],['根据',['gen1','ju4']],['正确',['zheng4','que4']],['处理',['chu3','li3']],['可以',['ke3','yi3']],['说明',['shuo1','ming2']],['需要',['xu1','yao4']],['可能',['ke3','neng2']],['作为',['zuo4','wei2']],['假设',['jia3','she4']],['长度',['chang2','du4']]];
test.each(entries)('the complete lexical word %s retains its established reading',(word,readings)=>{
 const a=analyzeChineseDetailed(word);
 expect(a.words).toHaveLength(1);expect(a.words[0].syllables.map(s=>s.reading)).toEqual(readings);
 expect(a.diagnostics.some(d=>d.code==='CHINESE_POLYPHONY')).toBe(false);
 expect(a.words[0].syllables.some(s=>s.candidates.length>1)).toBe(true);
 expect(convert(word,{mode:'text'}).complete).toBe(true);
});
test('manual overrides retain priority over complete-word defaults',()=>{
 const a=analyzeChineseDetailed('进行',[{start:0,end:2,readings:['jin4','hang2']}]);
 expect(a.words[0].syllables.map(s=>s.reading)).toEqual(['jin4','hang2']);
 expect(a.words[0].syllables.every(s=>s.source==='manual')).toBe(true);
});
test('custom providers are not promoted by lexical defaults',()=>{
 const a=analyzeChineseDetailed('进行',[],0,text=>[...text].map((raw,i)=>({raw,reading:i?'hang2':'jin4',candidates:i?['hang2','xing2']:['jin4']})));
 expect(a.words[0].syllables[1].reading).toBe('hang2');
 expect(a.diagnostics.some(d=>d.code==='CHINESE_POLYPHONY')).toBe(true);
});
test.each(['中','行','数','结果'])('isolated or meaning-dependent %s still requires review',word=>{
 expect(analyzeChineseDetailed(word).diagnostics.some(d=>d.code==='CHINESE_POLYPHONY')).toBe(true);
});
test('externally split words do not acquire an inferred whole-word reading',()=>{
 const a=analyzeChineseDetailed('进行',[],0,undefined,[{start:0,end:1},{start:1,end:2}]);
 expect(a.words.map(w=>w.raw)).toEqual(['进','行']);
 expect(a.diagnostics.some(d=>d.code==='CHINESE_POLYPHONY')).toBe(true);
});
test('aligned math text retains accepted lexical words and exact source offsets',()=>{
 const source=String.raw`\begin{aligned}\text{假设}&x>0\\\text{得到}&x^2>0\end{aligned}`,r=convert(source,{mode:'math',paragraphIndent:0});
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 for(const word of ['假设','得到'])expect(r.metadata.chineseWords.some(w=>w.raw===word && source.slice(w.span.start,w.span.end)===word)).toBe(true);
});
