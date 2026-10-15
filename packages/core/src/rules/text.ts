import type { BrailleCellAtom, Diagnostic, SourceSpan } from "../model";
import {latinDiacritics,LATIN_DIACRITIC_NAMES} from './latin-diacritics';
import {TEXT_NUMBER_FORMS} from './text-number-forms';
import {CYRILLIC_LETTER_NAMES} from './cyrillic-letter-names';
import {LATIN_LETTER_NAMES} from './latin-letter-names';
import {ARABIC_CHARACTER_NAMES} from './arabic-character-names';
import {DEVANAGARI_CHARACTER_NAMES} from './devanagari-character-names';
import {UNICODE_SPACE_NAMES} from './unicode-space-names';
import {
  analyzeChineseDetailed,
  type ChineseAnalysis,
  type ChineseOverride,
  type ChineseWord,
} from "../language/chinese";
import {
  encodeChineseDetailed,
  PUNCTUATION,
  type ChineseEncodingOptions,
} from "./chinese";
import { braille, DIGITS, LOWER_DIGITS, LATIN_DOTS, GREEK_COMMANDS, GREEK_DOTS, SYMBOLS, CIRCLED_NUMBERS } from "./math-symbols";
export interface TextUnit {
  raw: string;
  span: SourceSpan;
}
export interface TextEncoding {
  atoms: BrailleCellAtom[];
  diagnostics: Diagnostic[];
  unhandled: TextUnit[];
  words: ChineseWord[];
  complete: boolean;
}
export interface TextOptions {
  /** @internal Straight-quote direction in the surrounding source document. */
  doubleQuoteOpening?: (span:SourceSpan)=>boolean;
  /** Context-confirmed ratio, including a fullwidth colon in prose. */
  colonMeaning?: (span: SourceSpan) => "ratio" | undefined;
  chinese?: ChineseEncodingOptions;
  overrides?: ChineseOverride[];
  /** Automatic source-bound whole-Han words, in absolute UTF-16 offsets; never manual readings. */
  wordBoundaries?: SourceSpan[];
  /** Transform readings on the existing word partition. Boundaries are separately editable. */
  analyze?: (analysis: ChineseAnalysis) => ChineseAnalysis;
  mathText?: boolean;
  /** Original TeX prose: soft whitespace differs from explicit paragraph breaks. */
  texWhitespace?:'inline'|'paragraph';
}
interface Segment {
  raw: string;
  span: SourceSpan;
  atoms: BrailleCellAtom[];
  word: boolean;
  punctuation?: string;
  mathSymbol?: boolean;
}
// OCR commonly returns ASCII punctuation inside literal prose. The glyphs
// share the checked prose punctuation meaning; their source is not rewritten.
const PROSE_PUNCTUATION_ALIASES: Readonly<Record<string,string>> = Object.freeze({
  ',':'，',';':'；',':':'：','?':'？','!':'！','.':'。','(':'（',')':'）','[':'［',']':'］',
  '．':'。','【':'［','】':'］','—':'——',
  '…':'……',
});
const GREEK_GLYPHS=new Set(Object.values(GREEK_COMMANDS));
const LITERAL_SYMBOL_NAMES:Readonly<Record<string,{label:string;readings:string[]}>>=Object.freeze({
  '_':{label:'下划线',readings:['xia4','hua4','xian4']},
  '#':{label:'井号',readings:['jing3','hao4']},
  '&':{label:'与号',readings:['yu3','hao4']},
  '\\':{label:'反斜线',readings:['fan3','xie2','xian4']},
  '$':{label:'美元符号',readings:['mei3','yuan2','fu2','hao4']},
  '•':{label:'实心圆点',readings:['shi2','xin1','yuan2','dian3']},
  '`':{label:'反引号',readings:['fan3','yin3','hao4']},
  '~':{label:'波浪号',readings:['bo1','lang4','hao4']},
  '°':{label:'度号',readings:['du4','hao4']},
  '–':{label:'短横线',readings:['duan3','heng2','xian4']},
  '○':{label:'空心圆圈',readings:['kong1','xin1','yuan2','quan1']},
  '△':{label:'空心上三角',readings:['kong1','xin1','shang4','san1','jiao3']},
  '★':{label:'实心星号',readings:['shi2','xin1','xing1','hao4']},
  '～':{label:'全角波浪号',readings:['quan2','jiao3','bo1','lang4','hao4']},
  '^':{label:'尖角号',readings:['jian1','jiao3','hao4']},
  '@':{label:'艾特号',readings:['ai4','te4','hao4']},
});
const GREEK_ALPHABET=Array.from('αβγδεζηθικλμνξοπρστυφχψω');
/** §5.4.2.4: markers precede words; there is no generic text closing marker. */
export function textWordMarkerDots(index: number, count: number): string[] {
  return count <= 3 || index === count - 1
    ? ["4"]
    : index === 0
      ? ["4", "4"]
      : [];
}
export function encodeText(
  raw: string,
  base = 0,
  options: TextOptions = {},
): TextEncoding {
  let analysis = analyzeChineseDetailed(
    raw,
    (options.overrides ?? []).filter(
      (o) => o.start < base + raw.length && o.end > base,
    ),
    base,
    undefined,
    (options.wordBoundaries ?? []).filter(o => o.start < base + raw.length && o.end > base),
  );
  if (options.analyze) analysis = options.analyze(analysis);
  const result: TextEncoding = {
    atoms: [],
    diagnostics: [...analysis.diagnostics],
    unhandled: [],
    words: analysis.words,
    complete: true,
  };
  const segments: Segment[] = [];
  let serial = 0;
  let sourceCharacterCaption:TextEncoding|undefined;
  const sourceCharacterCodes=new Map<string,TextEncoding>();
  const numberFormCaptions=new Map<string,TextEncoding>();
  let doubleQuoteOpen=false;
  const atom = (
    cells: string,
    span: SourceSpan,
    ruleId: string,
    extra: Partial<BrailleCellAtom> = {},
  ): BrailleCellAtom => ({
    kind: "cell",
    cells,
    span,
    ruleId,
    group: `text:${base}:${serial++}`,
    breakBefore: false,
    breakAfter: true,
    ...extra,
  });
  const space = (span: SourceSpan, count = 1, preserve = false) =>
    atom(braille(Array(count).fill("0")), span, "GBT44725-2024-4.8", {
      preserveSpace: preserve,
    });
  for (let wi = 0; wi < analysis.words.length; wi++) {
    const word = analysis.words[wi];
    if (word.kind === "chinese") {
      if (wi && analysis.words[wi - 1].kind === "chinese")
        segments.push({
          raw: " ",
          span: { start: word.span.start, end: word.span.start },
          atoms: [space({ start: word.span.start, end: word.span.start })],
          word: false,
        });
      const r = encodeChineseDetailed([word], options.chinese);
      result.diagnostics.push(...r.diagnostics);
      result.unhandled.push(...r.unhandled);
      segments.push({
        raw: word.raw,
        span: word.span,
        atoms: r.atoms,
        word: true,
      });
      continue;
    }
    for (const match of word.raw.matchAll(
      /\d+(?:[.．]\d+)?|[A-Za-z]+|[\p{Script=Greek}]+|——|……|[ \t\r\n]+|\u3000|./gsu,
    )) {
      let value = match[0];
      const span = {
        start: word.span.start + match.index,
        end: word.span.start + match.index + value.length,
      };
      if (value === "：" && options.colonMeaning?.(span) === "ratio")
        value = ":";
      let encoded: BrailleCellAtom[] = [],
        isWord = false,mathSymbol=false;
      const decoratedLatin=latinDiacritics(value);
      let punctuationValue = Object.hasOwn(PUNCTUATION,value) ? value : Object.hasOwn(PROSE_PUNCTUATION_ALIASES,value) ? PROSE_PUNCTUATION_ALIASES[value] : '';
      if(value==='"') {punctuationValue=(options.doubleQuoteOpening?.(span) ?? !doubleQuoteOpen)?'“':'”';doubleQuoteOpen=!doubleQuoteOpen;}
      // An explicitly resolved colon retains ratio semantics instead of prose.
      const prosePunctuation = punctuationValue && !(value===':' && options.colonMeaning?.(span)==='ratio');
      if (prosePunctuation)
        encoded = encodeChineseDetailed(
          [{ ...word, raw: punctuationValue, span }],
          options.chinese,
        ).atoms.map(a=>({...a,span}));
      else if (!options.mathText && /^[\u2460-\u2469]$/u.test(value)) {
        // GF 0019—2018 informative Annex B: an encircled numeral uses the
        // number sign followed by lowered digit cells. Keep it distinct from
        // NFKC-normalized ordinary digits (① must not silently become 1).
        const numeral = value.codePointAt(0)! - 0x2460 + 1;
        encoded = [atom(
          braille(["3456", ...Array.from(String(numeral), digit => LOWER_DIGITS[+digit])]),
          span,
          "GF0019-2018-B",
        )];
        isWord = true;
      }
      else if(Object.hasOwn(CIRCLED_NUMBERS,value)) {
        // The numeral and trailing §6.5.2.5 circle are one source glyph/unit.
        // Preserve all decimal digits; do not collapse ⑩ into separate ①⓪.
        encoded=[atom(braille(['3456',...Array.from(CIRCLED_NUMBERS[value],c=>DIGITS[+c]),'6','356']),span,'GBT18028-2010-6.5')];
        isWord=true;
      }
      else if (/^\d/.test(value)) {
        encoded = [
          atom(
            braille([
              "3456",
              ...Array.from(value, (c) => ([".","．"].includes(c) ? "2" : DIGITS[+c])),
            ]),
            span,
            "GBT18028-2010-5.1",
          ),
        ];
        isWord = true;
      } else if (/^[A-Za-z]+$/.test(value)) {
        let type = "";
        const dots: string[] = [];
        for (const c of value) {
          const next = c === c.toLowerCase() ? "56" : "6";
          if (next !== type) dots.push(next);
          dots.push(LATIN_DOTS[c.toLowerCase().charCodeAt(0) - 97]);
          type = next;
        }
        // No guessed English syllable boundaries: a whole foreign word is atomic.
        encoded = [atom(braille(dots), span, "GBT18028-2010-5.2")];
        isWord = true;
      } else if(Object.hasOwn(UNICODE_SPACE_NAMES,value)) {
        const group=`unicode-space:${base}:${serial++}`;
        const caption=numberFormCaptions.get('空白')??encodeText('空白',0,{mathText:options.mathText,chinese:options.chinese,overrides:[{start:0,end:2,readings:['kong4','bai2']}],wordBoundaries:[{start:0,end:2}]});numberFormCaptions.set('空白',caption);
        const name=encodeText(UNICODE_SPACE_NAMES[value],0);
        encoded=[atom(braille(['12346']),span,'editorial-unicode-space',{sourceRole:'structure',group}),
          ...caption.atoms.map(a=>({...a,span,sourceRole:'structure' as const,group,ruleId:'editorial-unicode-space'})),space(span),
          ...name.atoms.map(a=>({...a,span,sourceRole:'structure' as const,group:`${group}:name`,ruleId:'editorial-unicode-space-name'})),
          atom(braille(['13456']),span,'editorial-unicode-space',{sourceRole:'structure',group:`${group}:name`})];
        result.diagnostics.push({code:'text-unicode-space-described',severity:'info',span,message:'Unicode space retains its official width/nonbreaking identity as a readable layout description; source is unchanged and print widths are not mapped to Braille cells.'});
        if(!caption.complete||!name.complete){result.unhandled.push({raw:value,span});encoded.push(atom(braille(['123456']),span,'unhandled-placeholder'));}
      } else if(options.texWhitespace && /^[ \t\r\n]+$/.test(value)) {
        const breaks=(value.match(/\r\n|\r|\n/g)??[]).length;
        if(breaks<2)encoded=[space(span,1)];
        else {
          const label='段落边界',caption=encodeText(label,0,{mathText:true,chinese:options.chinese,overrides:[{start:0,end:4,readings:['duan4','luo4','bian1','jie4']}],wordBoundaries:[{start:0,end:4}]});
          const group=`tex-paragraph:${base}:${serial++}`;
          encoded=[atom(braille(['12346']),span,'editorial-tex-paragraph',{sourceRole:'structure',group}),...caption.atoms.map(a=>({...a,span,sourceRole:'structure' as const,group,ruleId:'editorial-tex-paragraph'})),atom(braille(['13456']),span,'editorial-tex-paragraph',{sourceRole:'structure',group})];
          if(!caption.complete || options.texWhitespace!=='paragraph') {
            result.unhandled.push({raw:value,span});encoded.push(atom('⠿',span,'unhandled-placeholder'));
            result.diagnostics.push({code:'text-tex-paragraph-unverified',severity:'warning',span,message:'Paragraph break inside restricted inline TeX text retained for review.'});
          }
        }
        result.diagnostics.push({code:'text-tex-whitespace-adapted',severity:'info',span,message:breaks<2?'TeX prose whitespace retained as one source-bound space.':'TeX paragraph boundary retained as a readable source-bound description.'});
      } else if (value === "\u3000") encoded = [space(span, 2, true)];
      else if (/^[ \t]+$/.test(value)) encoded = [space(span, value.length)];
      else if (Object.hasOwn(SYMBOLS, value)) {
        const rule = SYMBOLS[value];
        mathSymbol=true;
        encoded = [
          atom(braille(["46", ...rule.dots]), span, "GBT18028-2010-5.4"),
        ];
      } else if(Array.from(value).every(c=>GREEK_GLYPHS.has(c) && GREEK_ALPHABET.includes(c.toLowerCase()))) {
        if(value.length>1) {
          const dots:string[]=[];let type='';
          for(const c of value){const next=c===c.toLowerCase()?'46':'456';if(next!==type)dots.push(next);dots.push(GREEK_DOTS[GREEK_ALPHABET.indexOf(c.toLowerCase())]);type=next;}
          encoded=[atom(braille(dots),span,'GBT18028-2010-5.2')];isWord=true;
        } else {
        mathSymbol=true;
        const index=GREEK_ALPHABET.indexOf(value.toLowerCase());
        encoded=[atom(braille(['46',value===value.toLowerCase()?'46':'456',GREEK_DOTS[index]]),span,'GBT18028-2010-5.2')];
        }
      } else if(Object.hasOwn(CYRILLIC_LETTER_NAMES,value)) {
        const form=CYRILLIC_LETTER_NAMES[value],group=`cyrillic-letter:${base}:${serial++}`;
        encoded.push(atom(braille(['12346']),span,'editorial-cyrillic-letter',{sourceRole:'structure',group}));
        let complete=true;
        const captions=[{label:'西里尔',readings:['xi1','li3','er3']},{label:form.upper?'大写':'小写',readings:[form.upper?'da4':'xiao3','xie3']},{label:form.ligature?'连字':'字母',readings:form.ligature?['lian2','zi4']:['zi4','mu3']}];
        for(const [index,{label,readings}] of captions.entries()){
          if(index)encoded.push(space(span));
          const caption=numberFormCaptions.get(label)??encodeText(label,0,{mathText:options.mathText,chinese:options.chinese,overrides:[{start:0,end:label.length,readings}],wordBoundaries:[{start:0,end:label.length}]});numberFormCaptions.set(label,caption);complete&&=caption.complete;
          encoded.push(...caption.atoms.map(a=>({...a,span,sourceRole:'structure' as const,group:index?`${group}:caption:${index}`:group,ruleId:'editorial-cyrillic-letter'})));
        }
        for(const [index,part] of form.name.split(' ').entries()){
          encoded.push({...space(span),...(index?{ruleId:'editorial-cyrillic-letter-name'}:{})});const body=encodeText(part,0);
          encoded.push(...body.atoms.map(a=>({...a,span,sourceRole:'structure' as const,group:`${group}:${index}`,ruleId:'editorial-cyrillic-letter-name'})));
        }
        encoded.push(atom(braille(['13456']),span,'editorial-cyrillic-letter',{sourceRole:'structure',group:encoded.at(-1)!.group}));
        result.diagnostics.push({code:'text-cyrillic-letter-described',severity:'info',span,message:'Cyrillic letter retains its official name and case under an editorial caption; this does not assert native language braille or linguistic pronunciation.'});
        if(!complete){result.unhandled.push({raw:value,span});encoded.push(atom(braille(['123456']),span,'unhandled-placeholder'));}
      } else if(Object.hasOwn(LATIN_LETTER_NAMES,value)) {
        const form=LATIN_LETTER_NAMES[value],group=`latin-identity-letter:${base}:${serial++}`;
        encoded.push(atom(braille(['12346']),span,'editorial-latin-identity-letter',{sourceRole:'structure',group}));
        let complete=true;
        const captions=[{label:'拉丁',readings:['la1','ding1']},{label:form.upper?'大写':'小写',readings:[form.upper?'da4':'xiao3','xie3']},{label:'字母',readings:['zi4','mu3']}];
        for(const [index,{label,readings}] of captions.entries()){
          if(index)encoded.push(space(span));
          const caption=numberFormCaptions.get(label)??encodeText(label,0,{mathText:options.mathText,chinese:options.chinese,overrides:[{start:0,end:label.length,readings}],wordBoundaries:[{start:0,end:label.length}]});numberFormCaptions.set(label,caption);complete&&=caption.complete;
          encoded.push(...caption.atoms.map(a=>({...a,span,sourceRole:'structure' as const,group:index?`${group}:caption:${index}`:group,ruleId:'editorial-latin-identity-letter'})));
        }
        for(const [index,part] of form.name.split(' ').entries()){
          encoded.push({...space(span),...(index?{ruleId:'editorial-latin-identity-letter-name'}:{})});const body=encodeText(part,0);
          encoded.push(...body.atoms.map(a=>({...a,span,sourceRole:'structure' as const,group:`${group}:${index}`,ruleId:'editorial-latin-identity-letter-name'})));
        }
        encoded.push(atom(braille(['13456']),span,'editorial-latin-identity-letter',{sourceRole:'structure',group:encoded.at(-1)!.group}));
        result.diagnostics.push({code:'text-latin-identity-letter-described',severity:'info',span,message:'Latin letter retains its official name and case under an editorial caption; this does not assert native language braille or linguistic pronunciation.'});
        if(!complete){result.unhandled.push({raw:value,span});encoded.push(atom(braille(['123456']),span,'unhandled-placeholder'));}
      } else if(Object.hasOwn(ARABIC_CHARACTER_NAMES,value)) {
        const form=ARABIC_CHARACTER_NAMES[value],group=`arabic-character:${base}:${serial++}`;
        encoded.push(atom(braille(['12346']),span,'editorial-arabic-character',{sourceRole:'structure',group}));
        let complete=true;
        const captions=[{label:'阿拉伯',readings:['a1','la1','bo2']},{label:form.kind==='mark'?'附标':form.kind==='modifier'?'修饰字符':'字母',readings:form.kind==='mark'?['fu4','biao1']:form.kind==='modifier'?['xiu1','shi4','zi4','fu2']:['zi4','mu3']}];
        for(const [index,{label,readings}] of captions.entries()){
          if(index)encoded.push(space(span));
          const caption=numberFormCaptions.get(label)??encodeText(label,0,{mathText:options.mathText,chinese:options.chinese,overrides:[{start:0,end:label.length,readings}],wordBoundaries:[{start:0,end:label.length}]});numberFormCaptions.set(label,caption);complete&&=caption.complete;
          encoded.push(...caption.atoms.map(a=>({...a,span,sourceRole:'structure' as const,group:index?`${group}:caption:${index}`:group,ruleId:'editorial-arabic-character'})));
        }
        for(const [index,part] of form.name.split(' ').entries()){
          encoded.push({...space(span),...(index?{ruleId:'editorial-arabic-character-name'}:{})});const body=encodeText(part,0);
          encoded.push(...body.atoms.map(a=>({...a,span,sourceRole:'structure' as const,group:`${group}:${index}`,ruleId:'editorial-arabic-character-name'})));
        }
        encoded.push(atom(braille(['13456']),span,'editorial-arabic-character',{sourceRole:'structure',group:encoded.at(-1)!.group}));
        result.diagnostics.push({code:'text-arabic-character-described',severity:'info',span,message:'Arabic character retains its official name, category and source order under an editorial caption; this does not assert native language braille or linguistic pronunciation.'});
        if(!complete){result.unhandled.push({raw:value,span});encoded.push(atom(braille(['123456']),span,'unhandled-placeholder'));}
      } else if(Object.hasOwn(DEVANAGARI_CHARACTER_NAMES,value)) {
        const form=DEVANAGARI_CHARACTER_NAMES[value],group=`devanagari-character:${base}:${serial++}`;
        encoded.push(atom(braille(['12346']),span,'editorial-devanagari-character',{sourceRole:'structure',group}));
        let complete=true;
        const captions=[{label:'天城文',readings:['tian1','cheng2','wen2']},{label:form.kind==='vowel-sign'?'元音附标':form.kind==='mark'?'附标':form.kind==='modifier'?'修饰字符':form.kind==='letter'?'字母':'符号',readings:form.kind==='vowel-sign'?['yuan2','yin1','fu4','biao1']:form.kind==='mark'?['fu4','biao1']:form.kind==='modifier'?['xiu1','shi4','zi4','fu2']:form.kind==='letter'?['zi4','mu3']:['fu2','hao4']}];
        for(const [index,{label,readings}] of captions.entries()){
          if(index)encoded.push(space(span));
          const caption=numberFormCaptions.get(label)??encodeText(label,0,{mathText:options.mathText,chinese:options.chinese,overrides:[{start:0,end:label.length,readings}],wordBoundaries:[{start:0,end:label.length}]});numberFormCaptions.set(label,caption);complete&&=caption.complete;
          encoded.push(...caption.atoms.map(a=>({...a,span,sourceRole:'structure' as const,group:index?`${group}:caption:${index}`:group,ruleId:'editorial-devanagari-character'})));
        }
        for(const [index,part] of form.name.split(' ').entries()){
          encoded.push({...space(span),...(index?{ruleId:'editorial-devanagari-character-name'}:{})});const body=encodeText(part,0);
          encoded.push(...body.atoms.map(a=>({...a,span,sourceRole:'structure' as const,group:`${group}:${index}`,ruleId:'editorial-devanagari-character-name'})));
        }
        encoded.push(atom(braille(['13456']),span,'editorial-devanagari-character',{sourceRole:'structure',group:encoded.at(-1)!.group}));
        result.diagnostics.push({code:'text-devanagari-character-described',severity:'info',span,message:'Devanagari character retains its official name, category and source order under an editorial caption; this does not assert native language braille or linguistic pronunciation.'});
        if(!complete){result.unhandled.push({raw:value,span});encoded.push(atom(braille(['123456']),span,'unhandled-placeholder'));}
      } else if(Object.hasOwn(TEXT_NUMBER_FORMS,value)) {
        const form=TEXT_NUMBER_FORMS[value],group=`number-form:${base}:${serial++}`;
        const caption=numberFormCaptions.get(form.label)??encodeText(form.label,0,{mathText:options.mathText,chinese:options.chinese,overrides:[{start:0,end:form.label.length,readings:form.readings}],wordBoundaries:[{start:0,end:form.label.length}]});numberFormCaptions.set(form.label,caption);
        encoded.push(atom(braille(['12346']),span,'editorial-number-form',{sourceRole:'structure',group}));
        encoded.push(...caption.atoms.map(a=>({...a,span,sourceRole:'structure' as const,group,ruleId:'editorial-number-form'})));
        const payloads=[form.value,...(form.spelling?[form.spelling]:[])];
        for(let index=0;index<payloads.length;index++){
          encoded.push(space(span));const body=encodeText(payloads[index],0);
          encoded.push(...body.atoms.map(a=>({...a,span,sourceRole:'structure' as const,group:`${group}:${index}`,ruleId:index?'editorial-number-form-spelling':'editorial-number-form-value'})));
        }
        encoded.push(atom(braille(['13456']),span,'editorial-number-form',{sourceRole:'structure',group:encoded.at(-1)!.group}));
        result.diagnostics.push({code:'text-number-form-described',severity:'info',span,message:'Explicit numeric glyph retains value and case/position/form description; source is not normalized and no new native GB sign is asserted.'});
        if(!caption.complete){result.unhandled.push({raw:value,span});encoded.push(atom(braille(['123456']),span,'unhandled-placeholder'));}
      } else if(decoratedLatin) {
        const group=`latin-description:${base}:${serial++}`;
        const parts=[{label:'拉丁字母',readings:['la1','ding1','zi4','mu3']},{label:decoratedLatin.base,readings:[]},...decoratedLatin.marks.map(m=>LATIN_DIACRITIC_NAMES[m])];
        encoded.push(atom(braille(['12346']),span,'editorial-latin-description',{sourceRole:'structure',group}));
        let complete=true;
        for(let index=0;index<parts.length;index++) {
          const p=parts[index];
          if(index)encoded.push(space(span));
          const label=encodeText(p.label,0,{mathText:options.mathText,chinese:options.chinese,...(p.readings.length?{overrides:[{start:0,end:p.label.length,readings:p.readings}],wordBoundaries:[{start:0,end:p.label.length}]}:{})});
          complete&&=label.complete;
          encoded.push(...label.atoms.map(a=>({...a,span,sourceRole:'structure' as const,group:`${group}:${index}`,ruleId:'editorial-latin-description'})));
        }
        encoded.push(atom(braille(['13456']),span,'editorial-latin-description',{sourceRole:'structure',group:encoded.at(-1)!.group}));
        encoded[0].group=encoded[1].group;
        result.diagnostics.push({code:'text-latin-described',severity:'info',span,message:'Latin base case and canonical diacritics retained as a readable glyph description; not a language-specific braille alphabet.'});
        if(!complete){result.unhandled.push({raw:value,span});encoded.push(atom(braille(['123456']),span,'unhandled-placeholder'));}
      } else if(Object.hasOwn(LITERAL_SYMBOL_NAMES,value) && !(options.mathText && value==='\\')) {
        const description=LITERAL_SYMBOL_NAMES[value];
        const label=encodeText(description.label,0,{mathText:options.mathText,chinese:options.chinese,
          overrides:[{start:0,end:description.label.length,readings:description.readings}],
          wordBoundaries:[{start:0,end:description.label.length}],
        });
        const group=`literal-description:${base}:${serial++}`;
        encoded=[atom(braille(['12346']),span,'editorial-text-symbol-description',{group,sourceRole:'structure'}),
          ...label.atoms.map(a=>({...a,span,group,sourceRole:'structure' as const,ruleId:'editorial-text-symbol-description'})),
          atom(braille(['13456']),span,'editorial-text-symbol-description',{group,sourceRole:'structure'})];
        result.diagnostics.push({code:'text-symbol-described',severity:'info',span,
          message:`Literal ${value} retained as ${description.label}; readable glyph description, not inferred document or mathematical syntax.`});
        if(!label.complete){result.unhandled.push({raw:value,span});encoded.push(atom(braille(['123456']),span,'unhandled-placeholder'));}
      } else {
        result.unhandled.push({ raw: value, span });
        result.diagnostics.push({
          code: "text-unhandled",
          severity: "error",
          span,
          message:
            "Source character has no checked prose encoding; placeholder and readable source character identifier retained.",
        });
        const group=`unhandled-character:${base}:${serial++}`;
        const points=[...value].map(c=>c.codePointAt(0)!);
        const identifier=points.map(cp=>`${cp>=0xD800&&cp<=0xDFFF?'UTF16+':'U+'}${cp.toString(16).toUpperCase().padStart(4,'0')}`).join(' ');
        const caption=sourceCharacterCaption??=encodeText('原文字符',0,{mathText:options.mathText,chinese:options.chinese,overrides:[{start:0,end:4,readings:['yuan2','wen2','zi4','fu2']}],wordBoundaries:[{start:0,end:4}]});
        const code=sourceCharacterCodes.get(identifier)??encodeText(identifier,0,{mathText:false});
        if(sourceCharacterCodes.size<256)sourceCharacterCodes.set(identifier,code);
        encoded=[atom(braille(['123456']),span,'unhandled-placeholder',{sourceRole:'structure',group}),
          atom(braille(['12346']),span,'editorial-source-character',{sourceRole:'structure',group}),
          ...caption.atoms.map(a=>({...a,span,sourceRole:'structure' as const,group,ruleId:'editorial-source-character'})),
          space(span),
          ...code.atoms.map(a=>({...a,span,sourceRole:'structure' as const,group:`${group}:code`,ruleId:'editorial-source-character-code'})),
          atom(braille(['13456']),span,'editorial-source-character',{sourceRole:'structure',group:`${group}:code`})];
        result.diagnostics.push({code:'text-source-character-transcribed',severity:'info',span,message:`Unsupported source retained as ${identifier}; identifier transcription is not a verified language/symbol translation.`});
      }
      segments.push({ raw: value, span, atoms: encoded, word: isWord, punctuation: prosePunctuation ? punctuationValue : undefined,mathSymbol });
    }
  }
  if (options.mathText) {
    // Punctuation ends a consecutive-word run; ordinary whitespace does not.
    for (let begin = 0; begin < segments.length; ) {
      if (!segments[begin].word) {
        begin++;
        continue;
      }
      let end = begin + 1;
      while (
        end < segments.length &&
        (segments[end].word || /^\s+$/u.test(segments[end].raw))
      )
        end++;
      const words = segments.slice(begin, end).filter((s) => s.word);
      words.forEach((segment, index) => {
        const marker = textWordMarkerDots(index, words.length);
        if (marker.length && segment.atoms.length)
          segment.atoms.unshift(
            atom(braille(marker), segment.span, "GBT18028-2010-5.4", {
              group: segment.atoms[0].group,
              textMarker: true,
              breakAfter: false,
            }),
          );
      });
      begin = end;
    }
  }
  const punctuation = (s: Segment | undefined) =>
    !!s?.punctuation;
  const open = new Set(["“", "‘", "（", "［", "〔", "【", "《", "〈"]),
    close = new Set(["”", "’", "）", "］", "〕", "】", "》", "〉"]);
  const requiredBlank = (span: SourceSpan) => {
    if (result.atoms.length && !/^\u2800+$/.test(result.atoms.at(-1)!.cells))
      result.atoms.push(space(span));
  };
  segments.forEach((segment, index) => {
    const isSymbol=!!segment.mathSymbol;
    // This is an inserted layout cell, not a second encoding of the opening
    // bracket or mathematical symbol. Anchor it at the boundary so source
    // mapping remains one-to-one for the actual punctuation cell.
    if (open.has(segment.punctuation ?? segment.raw) || isSymbol)
      requiredBlank({ start: segment.span.start, end: segment.span.start });
    if (segment.raw === "·" && result.atoms.length) {
      // §4.8.5 prohibits starting a line with an interpunct.
      const group = result.atoms.at(-1)!.group;
      segment.atoms = segment.atoms.map((a) => ({
        ...a,
        group,
        breakBefore: false,
      }));
    }
    // Coalesce only a synthetic required space with the adjacent ordinary space.
    if (
      /^\s+$/.test(segment.raw) &&
      result.atoms.length &&
      result.atoms.at(-1)!.span.start === result.atoms.at(-1)!.span.end &&
      /^\u2800+$/.test(result.atoms.at(-1)!.cells)
    )
      result.atoms.pop();
    result.atoms.push(...segment.atoms);
    const next = segments[index + 1];
    const after =
      ["，", "、", "；", "："].includes(segment.punctuation ?? segment.raw) ||
      (segment.punctuation === "……" && next && !punctuation(next)) ||
      close.has(segment.punctuation ?? segment.raw) ||
      isSymbol;
    if (after && next && !/^\s+$/.test(next.raw))
      requiredBlank({ start: segment.span.end, end: segment.span.end });
  });
  result.complete =
    result.unhandled.length === 0 &&
    !result.diagnostics.some((d) => d.severity !== "info");
  return result;
}
