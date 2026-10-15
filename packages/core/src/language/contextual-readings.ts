import {checkedChineseLexicon} from './checked-lexicon';

/** Complete modern-Mandarin lexical entries, not substring or sentence guesses.
 * Dictionary provenance and applicability are recorded in
 * docs/contextual-chinese-readings.md. Manual readings always take priority.
 */
const editorialReadings:Readonly<Record<string,readonly string[]>>=Object.freeze({
 银行:['yin2','hang2'],通知:['tong1','zhi1'],会议:['hui4','yi4'],
 因为:['yin1','wei4'],未知:['wei4','zhi1'],已知:['yi3','zhi1'],
 概率:['gai4','lü4'],集合:['ji2','he2'],函数:['han2','shu4'],盲文:['mang2','wen2'],
 // Exact complete-word dictionary entries; see the evidence table in the docs.
 其中:['qi2','zhong1'],分别:['fen1','bie2'],进行:['jin4','xing2'],系数:['xi4','shu4'],
 得到:['de2','dao4'],根据:['gen1','ju4'],正确:['zheng4','que4'],处理:['chu3','li3'],
 可以:['ke3','yi3'],说明:['shuo1','ming2'],需要:['xu1','yao4'],可能:['ke3','neng2'],
 作为:['zuo4','wei2'],假设:['jia3','she4'],长度:['chang2','du4'],
 对应:['dui4','ying4'],条件:['tiao2','jian4'],关系:['guan1','xi4'],
 不同:['bu4','tong2'],过程:['guo4','cheng2'],分析:['fen1','xi1'],
 向量:['xiang4','liang4'],相同:['xiang1','tong2'],
 数量:['shu4','liang4'],选择:['xuan3','ze2'],解析:['jie3','xi1'],
 所有:['suo3','you3'],主要:['zhu3','yao4'],曲线:['qu1','xian4'],
 数学:['shu4','xue2'],任意:['ren4','yi4'],是否:['shi4','fou3'],
 必要:['bi4','yao4'],答案:['da2','an4'],平行:['ping2','xing2'],
 角度:['jiao3','du4'],不等式:['bu4','deng3','shi4'],三角形:['san1','jiao3','xing2'],
 种类:['zhong3','lei4'],负数:['fu4','shu4'],解答:['jie3','da2'],
 化学:['hua4','xue2'],有理数:['you3','li3','shu4'],充分:['chong1','fen4'],
 // Source-checked complete terms; compound inferences are explicit in the docs.
 空间:['kong1','jian1'],时间:['shi2','jian1'],变化:['bian4','hua4'],区间:['qu1','jian1'],
 单位:['dan1','wei4'],最大:['zui4','da4'],同时:['tong2','shi2'],指数:['zhi3','shu4'],
 重要:['zhong4','yao4'],相似:['xiang1','si4'],数值:['shu4','zhi2'],实数:['shi2','shu4'],
 相等:['xiang1','deng3'],体积:['ti3','ji1'],整数:['zheng3','shu4'],导数:['dao3','shu4'],
 次数:['ci4','shu4'],减少:['jian3','shao3'],总数:['zong3','shu4'],至少:['zhi4','shao3'],
 分母:['fen1','mu3'],相交:['xiang1','jiao1'],复数:['fu4','shu4'],倍数:['bei4','shu4'],
 // Source-checked complete physical/mathematical terms (2026-10-15); no new word joins.
 速度:["su4","du4"],
 大小:["da4","xiao3"],
 中心:["zhong1","xin1"],
 功率:["gong1","lü4"],
 能量:["neng2","liang4"],
 降低:["jiang4","di1"],
 几何:["ji3","he2"],
 频率:["pin2","lü4"],
 常数:["chang2","shu4"],
 增长:["zeng1","zhang3"],
 求解:["qiu2","jie3"],
 内部:["nei4","bu4"],
 数列:["shu4","lie4"],
 乘法:["cheng2","fa3"],
 重心:["zhong4","xin1"],
 长方形:["chang2","fang1","xing2"],
 除数:["chu2","shu4"],
 速率:["su4","lü4"],
 调整:["tiao2","zheng3"],
 调节:["tiao2","jie2"],
 下降:["xia4","jiang4"],
 高度:["gao1","du4"],
 // §12.2.4 directly illustrated repeated words. These were already preserved
 // as complete words by segmentation; their base readings must stay correct.
 来来往往:['lai2','lai2','wang3','wang3'],说说笑笑:['shuo1','shuo1','xiao4','xiao4'],
 清清楚楚:['qing1','qing1','chu3','chu3'],弯弯曲曲:['wan1','wan1','qu1','qu1'],
});
export function contextualWordReadings(word:string):readonly string[]|undefined {
 return editorialReadings[word] ?? checkedChineseLexicon[word]?.readings;
}
