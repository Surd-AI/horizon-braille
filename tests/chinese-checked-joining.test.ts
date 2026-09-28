import {expect,test} from 'vitest';
import {analyzeChineseDetailed} from '../packages/core/src/language/chinese';
test.each(['超声波','无条件','半导体','科学性','手工业者','乘务员','艺术家','拖拉机手','很好','山上','每年','图书馆','电视机','阅读'])('checked whole-word %s joins fine automatic proposals',source=>{
 const spans=[...source].map((_,i)=>({start:i,end:i+1}));
 expect(analyzeChineseDetailed(source,[],0,undefined,spans).words.map(w=>w.raw)).toEqual([source]);
});
test('checked joining does not split larger proposals or cross manual spans',()=>{
 const source='艺术家乡村';
 const spans=[{start:0,end:2},{start:2,end:4},{start:4,end:5}];
 expect(analyzeChineseDetailed(source,[],0,undefined,spans).words.map(w=>w.raw)).toEqual(['艺术','家乡','村']);
 const s='科学性';
 expect(analyzeChineseDetailed(s,[{start:0,end:2,readings:['ke1','xue2']}],0,undefined,[{start:0,end:1},{start:1,end:2},{start:2,end:3}]).words.map(w=>w.raw)).toEqual(['科学','性']);
});
test('exact repetition stays separate and punctuation/source offsets remain intact',()=>{
 const s='阅读阅读，超声波';const spans=[{start:0,end:1},{start:1,end:2},{start:2,end:3},{start:3,end:4},{start:5,end:6},{start:6,end:7},{start:7,end:8}];
 const r=analyzeChineseDetailed(s,[],0,undefined,spans);
 expect(r.words.map(w=>w.raw)).toEqual(['阅读','阅读','，','超声波']);
 expect(r.words.every(w=>s.slice(w.span.start,w.span.end)===w.raw)).toBe(true);
});
