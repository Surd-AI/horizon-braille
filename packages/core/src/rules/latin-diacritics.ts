/** Bounded canonical decomposition only; never NFKC/NFKD or transliteration.
 * Glyph identities: Unicode Latin and Combining Diacritical Marks charts.
 */
export const LATIN_DIACRITIC_NAMES:Readonly<Record<string,{label:string;readings:string[]}>>=Object.freeze({
 '\u0300':{label:'上方抑音号',readings:['shang4','fang1','yi4','yin1','hao4']},
 '\u0301':{label:'上方锐音号',readings:['shang4','fang1','rui4','yin1','hao4']},
 '\u0302':{label:'上方尖帽号',readings:['shang4','fang1','jian1','mao4','hao4']},
 '\u0303':{label:'上方波浪号',readings:['shang4','fang1','bo1','lang4','hao4']},
 '\u0304':{label:'上方横线号',readings:['shang4','fang1','heng2','xian4','hao4']},
 '\u0306':{label:'上方短音号',readings:['shang4','fang1','duan3','yin1','hao4']},
 '\u0307':{label:'上方点号',readings:['shang4','fang1','dian3','hao4']},
 '\u0308':{label:'上方双点号',readings:['shang4','fang1','shuang1','dian3','hao4']},
 '\u0309':{label:'上方钩号',readings:['shang4','fang1','gou1','hao4']},
 '\u030A':{label:'上方圆圈号',readings:['shang4','fang1','yuan2','quan1','hao4']},
 '\u030B':{label:'上方双锐音号',readings:['shang4','fang1','shuang1','rui4','yin1','hao4']},
 '\u030C':{label:'上方楔号',readings:['shang4','fang1','xie1','hao4']},
 '\u031B':{label:'附加角号',readings:['fu4','jia1','jiao3','hao4']},
 '\u0323':{label:'下方点号',readings:['xia4','fang1','dian3','hao4']},
 '\u0324':{label:'下方双点号',readings:['xia4','fang1','shuang1','dian3','hao4']},
 '\u0325':{label:'下方圆圈号',readings:['xia4','fang1','yuan2','quan1','hao4']},
 '\u0327':{label:'下方软音号',readings:['xia4','fang1','ruan3','yin1','hao4']},
 '\u0328':{label:'下方尾钩号',readings:['xia4','fang1','wei3','gou1','hao4']},
 '\u032D':{label:'下方尖帽号',readings:['xia4','fang1','jian1','mao4','hao4']},
 '\u032E':{label:'下方短音号',readings:['xia4','fang1','duan3','yin1','hao4']},
 '\u0330':{label:'下方波浪号',readings:['xia4','fang1','bo1','lang4','hao4']},
 '\u0331':{label:'下方横线号',readings:['xia4','fang1','heng2','xian4','hao4']},
});
export function latinDiacritics(value:string):{base:string;marks:string[]}|undefined {
 if([...value].length!==1)return;
 const cp=value.codePointAt(0)!;
 if(!(cp>=0xC0&&cp<=0x24F || cp>=0x1E00&&cp<=0x1EFF))return;
 const [base,...marks]=[...value.normalize('NFD')];
 if(!/^[A-Za-z]$/.test(base)||!marks.length||marks.length>3||!marks.every(m=>Object.hasOwn(LATIN_DIACRITIC_NAMES,m)))return;
 return {base,marks};
}
