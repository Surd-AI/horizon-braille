/** Exact examples checked against GF 0019—2018, printed pages 10 and 12.
 * This bounded lexicon is not a general grammatical segmentation algorithm.
 * Only complete adjacent automatic proposals may be joined; manual spans win.
 */
export const checkedChineseLexicon: Record<string, { readings: readonly string[]; ruleId: string }> = {};
const examples: [string, string, string][] = [
  ['阅读','yue4 du2','12.2.1'], ['晚会','wan3 hui4','12.2.1'],
  ['地震','di4 zhen4','12.2.1'], ['年轻','nian2 qing1','12.2.1'],
  ['签名','qian1 ming2','12.2.1'], ['示威','shi4 wei1','12.2.1'],
  ['扭转','niu3 zhuan3','12.2.1'], ['船只','chuan2 zhi1','12.2.1'],
  ['但是','dan4 shi4','12.2.1'], ['叮咚','ding1 dong1','12.2.1'],
  ['芙蓉','fu2 rong2','12.2.1'], ['巧克力','qiao3 ke4 li4','12.2.1'],
  ['电视机','dian4 shi4 ji1','12.2.1'], ['图书馆','tu2 shu1 guan3','12.2.1'],
  ['全国','quan2 guo2','12.2.2'], ['走来','zou3 lai2','12.2.2'],
  ['胆小','dan3 xiao3','12.2.2'], ['环保','huan2 bao3','12.2.2'],
  ['公关','gong1 guan1','12.2.2'],
  ['超声波','chao1 sheng1 bo1','12.2.5'], ['无条件','wu2 tiao2 jian4','12.2.5'],
  ['半导体','ban4 dao3 ti3','12.2.5'], ['科学性','ke1 xue2 xing4','12.2.5'],
  ['手工业者','shou3 gong1 ye4 zhe3','12.2.5'], ['乘务员','cheng2 wu4 yuan2','12.2.5'],
  ['艺术家','yi4 shu4 jia1','12.2.5'], ['拖拉机手','tuo1 la1 ji1 shou3','12.2.5'],
  ['孩子们','hai2 zi5 men5','12.2.5'],
  ['很好','hen3 hao3','12.2.6'], ['山上','shan1 shang4','12.2.6'],
  ['每年','mei3 nian2','12.2.6'],
];
for (const [word, reading, clause] of examples)
  checkedChineseLexicon[word] = { readings: reading.split(' '), ruleId: `GF0019-2018-${clause}` };
