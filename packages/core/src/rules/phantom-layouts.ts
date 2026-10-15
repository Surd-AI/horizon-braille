/** TeX phantom scopes hide ink while retaining specified print dimensions.
 * Editorial descriptions retain source content; print metrics are not converted to Braille cell counts.
 * Reference: KaTeX src/functions/phantom.js (bundled dependency). */
export const PHANTOM_LAYOUTS:Readonly<Record<string,{label:string;readings:string[]}>>=Object.freeze({
 phantom:{label:'不可见尺寸占位',readings:['bu4','ke3','jian4','chi3','cun4','zhan4','wei4']},
 hphantom:{label:'不可见水平占位',readings:['bu4','ke3','jian4','shui3','ping2','zhan4','wei4']},
 vphantom:{label:'不可见垂直占位',readings:['bu4','ke3','jian4','chui2','zhi2','zhan4','wei4']},
});
