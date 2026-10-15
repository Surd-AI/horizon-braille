/** Unicode Mathematical Alphanumeric/Letterlike charts. Only scoped
 * letter forms are adapted; unrelated NFKC compatibility text is not. */
export interface MathematicalLetter {letter:string;font:string}
const blocks:readonly [number,number,string][]=[
 [0x1d400,0x1d433,'mathbf'],[0x1d434,0x1d467,'mathit'],[0x1d468,0x1d49b,'boldsymbol'],
 [0x1d49c,0x1d4cf,'mathscr'],[0x1d4d0,0x1d503,'mathbfscr'],[0x1d504,0x1d537,'mathfrak'],
 [0x1d538,0x1d56b,'mathbb'],[0x1d56c,0x1d59f,'mathbffrak'],[0x1d5a0,0x1d5d3,'mathsf'],
 [0x1d5d4,0x1d607,'mathboldsf'],[0x1d608,0x1d63b,'mathitsf'],[0x1d63c,0x1d66f,'mathbolditsf'],
 [0x1d670,0x1d6a3,'mathtt'],
];
const letters:Record<string,MathematicalLetter>={};
for(const [start,end,font] of blocks)for(let point=start;point<=end;point++) {
 const glyph=String.fromCodePoint(point),letter=glyph.normalize('NFKC');
 if(/^[A-Za-z]$/.test(letter))letters[glyph]=Object.freeze({letter,font});
}
for(const [font,glyphs] of [
 ['mathbb','ℂℍℕℙℚℝℤ'],['mathfrak','ℭℌℑℜℨ'],['mathscr','ℬℰℱℋℐℒℳℛℯℊℴ'],['mathit','ℎ'],
])for(const glyph of glyphs)letters[glyph]=Object.freeze({letter:glyph.normalize('NFKC'),font});
// Each Greek family has 25 capitals, nabla, 25 small letters and seven
// operator/variant symbols. The capital theta-symbol and final sigma slots
// remain distinct unresolved forms; no compatibility flattening is applied.
const greekFamilies:readonly [number,string][]=[
 [0x1d6a8,'mathbf'],[0x1d6e2,'mathit'],[0x1d71c,'boldsymbol'],
 [0x1d756,'mathboldsf'],[0x1d790,'mathbolditsf'],
];
for(const [start,font] of greekFamilies)for(const offset of [0,26])for(let index=0;index<25;index++) {
 if(index===17)continue;
 const glyph=String.fromCodePoint(start+offset+index),letter=glyph.normalize('NFKC');
 if(/^[ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρστυφχψω]$/.test(letter))letters[glyph]=Object.freeze({letter,font});
}
export const MATHEMATICAL_LETTERS:Readonly<Record<string,MathematicalLetter>>=Object.freeze(letters);
