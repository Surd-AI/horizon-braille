import {UNICODE_SUPERSCRIPT_DIGITS,UNICODE_SUBSCRIPT_DIGITS} from './math-symbols';
type NumberForm={label:string;readings:string[];value:string;spelling?:string;roman?:boolean};
const forms:Record<string,NumberForm>={};
const values=[1,2,3,4,5,6,7,8,9,10,11,12,50,100,500,1000];
const spellings=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','L','C','D','M'];
for(let index=0;index<16;index++)for(const small of [false,true]){
 forms[String.fromCodePoint((small?0x2170:0x2160)+index)]={label:small?'小写罗马数字':'大写罗马数字',readings:[small?'xiao3':'da4','xie3','luo2','ma3','shu4','zi4'],value:String(values[index]),spelling:small?spellings[index].toLowerCase():spellings[index],roman:true};
}
for(const [cp,value] of [[0x2180,1000],[0x2181,5000],[0x2182,10000],[0x2185,6],[0x2186,50],[0x2187,50000],[0x2188,100000]]){
 forms[String.fromCodePoint(cp)]={label:'特殊罗马数字',readings:['te4','shu1','luo2','ma3','shu4','zi4'],value:String(value),spelling:`U+${cp.toString(16).toUpperCase()}`,roman:true};
}
for(const [table,upper] of [[UNICODE_SUPERSCRIPT_DIGITS,true],[UNICODE_SUBSCRIPT_DIGITS,false]] as const)for(const [glyph,value] of Object.entries(table))if(/^\d$/.test(value)){
 forms[glyph]={label:upper?'上标数字':'下标数字',readings:[upper?'shang4':'xia4','biao1','shu4','zi4'],value};
}
/** Finite glyph whitelist, not NFKC/NFKD and not inferred Roman text arithmetic. */
export const TEXT_NUMBER_FORMS:Readonly<Record<string,NumberForm>>=Object.freeze(forms);
