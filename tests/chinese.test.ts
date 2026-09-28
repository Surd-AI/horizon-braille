import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {analyzeChinese,analyzeChineseDetailed} from '../packages/core/src/language/chinese';
import {encodeChinese,encodeChineseDetailed} from '../packages/core/src/rules/chinese';
const cells=(dots:string[])=>dots.map(d=>String.fromCharCode(0x2800+[...d].reduce((n,c)=>n|(1<<(Number(c)-1)),0))).join('');
const fixtures=JSON.parse(readFileSync('tests/standards/gf0019.json','utf8'));
for(const f of fixtures.filter((f: { input: { text?: string } }) => typeof f.input.text === 'string')) test(f.id,()=>{
 const words=analyzeChinese(f.input.text,[{start:0,end:f.input.text.length,readings:f.input.readings}]);
 expect(encodeChinese(words,f.input.options).map(a=>a.cells).join('')).toBe(cells(f.expectedDots));
});
test('analysis preserves context, base tones, candidates, and global UTF16 offsets',()=>{
 const a=analyzeChineseDetailed('😀重庆一不',[],10);
 const s=a.words.flatMap(w=>w.syllables);
 expect(s.map(x=>x.reading)).toEqual(['chong2','qing4','yi1','bu4']);
 expect(s[0].span).toEqual({start:12,end:13});
 expect(s[0].candidates).toContain('zhong4');
 expect(a.words[0].raw).toBe('😀');
 expect(a.diagnostics.some(d=>d.code==='CHINESE_POLYPHONY')).toBe(true);
});
test('manual joining changes consonant-only tone omission',()=>{
 const joined=analyzeChinese('慈爱',[{start:0,end:2,readings:['ci2','ai4']}]);
 const split=analyzeChinese('慈爱',[{start:0,end:1,readings:['ci2']},{start:1,end:2,readings:['ai4']}]);
 expect(encodeChinese(joined).map(a=>a.cells).join('')).toBe(cells(['14','2','246']));
 expect(encodeChinese(split).map(a=>a.cells).join('')).toBe(cells(['14','','246']));
 expect(encodeChinese(joined)[0].continuation).toEqual({lineEnd:'',lineStart:cells(['36'])});
});
test('invalid overrides diagnose without dropping source',()=>{
 for(const o of [{start:0,end:2,readings:['ni3']},{start:0,end:1,readings:['ni9']},{start:1,end:9,readings:['ni3'] }]){
 const a=analyzeChineseDetailed('你好',[o]);
 expect(a.diagnostics.some(d=>d.code==='CHINESE_INVALID_OVERRIDE')).toBe(true);
 expect(a.words.map(w=>w.raw).join('')).toBe('你好');
 }
});
test('non-Han and unknown readings are explicitly retained downstream',()=>{
 const a=analyzeChineseDetailed('3kg①😀𠮷米');
 expect(a.words.map(w=>w.raw).join('')).toBe('3kg①😀𠮷米');
 const e=encodeChineseDetailed(a.words);
 expect(e.unhandled.map(w=>w.raw).join('')).toContain('3kg①😀');
 expect(e.diagnostics.some(d=>d.code==='CHINESE_DOWNSTREAM_TEXT')).toBe(true);
});
test('sequential and concurrent conversions cannot mutate earlier results',async()=>{
 const a=analyzeChinese('重庆'); const before=JSON.stringify(a); const encoded=JSON.stringify(encodeChinese(a));
 await Promise.all(['银行','音乐','花','一不'].map(async t=>encodeChinese(analyzeChinese(t))));
 expect(JSON.stringify(a)).toBe(before); expect(JSON.stringify(encodeChinese(a))).toBe(encoded);
});
test('unsupported syllable is diagnosed and retained',()=>{
 const a=analyzeChinese('嗯',[{start:0,end:1,readings:['ng2']}]);
 const e=encodeChineseDetailed(a);
 expect(e.diagnostics.some(d=>d.code==='CHINESE_UNKNOWN_SYLLABLE')).toBe(true);
 expect(e.unhandled[0].raw).toBe('嗯');
});
import {INITIALS,FINALS,normalizeSyllable,PUNCTUATION} from '../packages/core/src/rules/chinese';
const render=(text:string,readings:string[],options={})=>encodeChinese(analyzeChinese(text,[{start:0,end:text.length,readings}]),options).map(a=>a.cells).join('');
test.each([
 ['的',['di2'],['145','24','2']],['么',['me5'],['134']],['怎么',['zen3','me5'],['1356','356','3','134']],
 ['么啊',['me5','a5'],['134','26','35']],['它用',['ta1','yong4'],['4','2345','35','1456']],
 ['她用',['ta1','yong4'],['2345','1','1456']],['你爱',['ni3','ai4'],['1345','24','3','246']],
 ['头',['tou5'],['2345','12356']],['乐',['yue4'],['23456']],['地道',['di4','dao4'],['145','24','23','145','235','23']],
] as [string,string[],string[]][])('reading-sensitive contractions/retention %s %s',(text,r,d)=>expect(render(text,r)).toBe(cells(d)));
test('full tones and semantic-retention policy are explicit',()=>{
 expect(render('坝',['ba4'],{tones:'full'})).toBe(cells(['12','35','23']));
 expect(render('坝',['ba4'],{unknownSemanticTone:'retain'})).toBe(cells(['12','35','23']));
 expect(render('你',['ni3'],{contractions:false})).toBe(cells(['1345','24','3']));
 const w=analyzeChinese('坝',[{start:0,end:1,readings:['ba4'],retainTones:[true]}]);
 expect(encodeChinese(w)[0].cells).toBe(cells(['12','35','23']));
});
test('neutral tone never emits a blank tone cell',()=>expect(render('吗',['ma5'])).toBe(cells(['134','35'])));
test.each([['ju4','j','ü'],['qun2','q','ün'],['xu4','x','ü'],['lun2','l','uen'],['liu2','l','iou'],['gui1','g','uei'],['nüe4','n','üe'],['weng1','','ueng'],['shi4','sh',''],['yuan2','','üan']])('orthographic normalization %s',(r,i,f)=>expect(normalizeSyllable(r)).toMatchObject({initial:i,final:f}));
test('complete independent initial and final table transcription',()=>{
 expect(Object.entries(INITIALS).map(([s,d])=>`${s}=${d}`).join(' ')).toBe('b=12 p=1234 m=134 f=124 d=145 t=2345 n=1345 l=123 g=1245 j=1245 k=13 q=13 h=125 x=125 zh=34 ch=12345 sh=156 r=245 z=1356 c=14 s=234');
 expect(Object.entries(FINALS).map(([s,d])=>`${s}=${d}`).join(' ')).toBe('a=35 o=26 e=26 i=24 u=136 ü=346 er=1235 ai=246 ao=235 ei=2346 ou=12356 ia=1246 iao=345 ie=15 iou=1256 ua=123456 uai=13456 uei=2456 uo=135 üe=23456 an=1236 ang=236 en=356 eng=3456 ian=146 iang=1346 in=126 ing=16 uan=12456 uang=2356 uen=25 ong=256 ueng=256 üan=12346 ün=456 iong=1456');
});
test('punctuation is atomic; spacing is downstream layout responsibility',()=>{
 expect(encodeChinese(analyzeChinese('——……。')).map(a=>a.cells)).toEqual([cells(['6','36']),cells(['5','5','5']),cells(['5','23'])]);
 expect(Object.keys(PUNCTUATION)).toHaveLength(24);
});
test('manual overrides reject overlaps and split surrogate boundaries',()=>{
 const a=analyzeChineseDetailed('𠮷你好',[{start:1,end:2,readings:['ji2']},{start:2,end:4,readings:['ni3','hao3']},{start:3,end:4,readings:['hao4']}]);
 expect(a.diagnostics.filter(d=>d.code==='CHINESE_INVALID_OVERRIDE')).toHaveLength(2);
 expect(a.words.map(w=>w.raw).join('')).toBe('𠮷你好');
});
test('bad reading provider cannot silently misalign text',()=>{
 const a=analyzeChineseDetailed('中国',[],7,()=>[{raw:'中',reading:'zhong1',candidates:[]}]);
 expect(a.diagnostics.filter(d=>d.code==='CHINESE_MISSING_READING')).toHaveLength(2);
 expect(encodeChineseDetailed(a.words).unhandled.map(w=>w.raw).join('')).toBe('中国');
});
test('repetition and plural suffix proposals retain normative joining',()=>{
 expect(analyzeChinese('人人').map(w=>w.raw)).toEqual(['人人']);
 expect(analyzeChinese('研究研究').map(w=>w.raw)).toEqual(['研究','研究']);
 expect(analyzeChinese('孩子们').map(w=>w.raw)).toEqual(['孩子们']);
});

test('only seven specified consonant-only syllables are legal',()=>{
 expect(normalizeSyllable('b1')).toBeNull();
 expect(normalizeSyllable('zh4')).toBeNull();
});
test.each([
 ['意', ['YI4'], ['24', '23']],
 ['你', ['NI3'], ['1345']],
 ['我', ['Wo3'], ['135']],
 ['再', ['ZaI4'], ['1356', '246', '23']],
 ['问', ['WeN4'], ['25', '23']],
 ['他用', ['Ta1', 'YoNg4'], ['2345', '35', '1456']],
] as [string, string[], string[]][])('canonical reading comparisons %s %s', (text, readings, expected) => {
 expect(render(text, readings)).toBe(cells(expected));
});
test('provider must align each character, not merely concatenate', () => {
 const a = analyzeChineseDetailed('中国', [], 0, () => [
  {raw:'中国', reading:'guo2', candidates:[]},
  {raw:'', reading:'zhong1', candidates:[]},
 ]);
 expect(a.diagnostics.filter(d => d.code === 'CHINESE_MISSING_READING')).toHaveLength(2);
 expect(a.words.flatMap(w => w.syllables).map(s => s.reading)).toEqual(['', '']);
 expect(encodeChineseDetailed(a.words).unhandled.map(w => w.raw)).toEqual(['中', '国']);
});
test('emoji remains one downstream source unit with a full UTF16 span', () => {
 const e = encodeChineseDetailed(analyzeChinese('😀'));
 expect(e.unhandled.map(w => ({raw:w.raw, span:w.span}))).toEqual([{raw:'😀', span:{start:0,end:2}}]);
 expect(e.diagnostics).toHaveLength(1);
});
test('exported punctuation tables cannot be mutated through nested arrays', () => {
 expect(Object.isFrozen(PUNCTUATION['。'])).toBe(true);
 expect(() => (PUNCTUATION['。'] as string[]).push('1')).toThrow();
 expect(encodeChinese(analyzeChinese('。'))[0].cells).toBe(cells(['5','23']));
});
