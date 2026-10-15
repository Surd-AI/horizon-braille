/** Unicode 18.0 U+0400–04FF letter/ligature names. Editorial identity descriptions only.
 * Source: https://www.unicode.org/Public/18.0.0/ucd/UnicodeData.txt
 * Nonletters and combining marks are intentionally excluded. */
export const CYRILLIC_LETTER_NAMES:Readonly<Record<string,{name:string;upper:boolean;ligature?:boolean}>>=Object.freeze({
  "Ѐ": {
    "name": "IE WITH GRAVE",
    "upper": true
  },
  "Ё": {
    "name": "IO",
    "upper": true
  },
  "Ђ": {
    "name": "DJE",
    "upper": true
  },
  "Ѓ": {
    "name": "GJE",
    "upper": true
  },
  "Є": {
    "name": "UKRAINIAN IE",
    "upper": true
  },
  "Ѕ": {
    "name": "DZE",
    "upper": true
  },
  "І": {
    "name": "BYELORUSSIAN-UKRAINIAN I",
    "upper": true
  },
  "Ї": {
    "name": "YI",
    "upper": true
  },
  "Ј": {
    "name": "JE",
    "upper": true
  },
  "Љ": {
    "name": "LJE",
    "upper": true
  },
  "Њ": {
    "name": "NJE",
    "upper": true
  },
  "Ћ": {
    "name": "TSHE",
    "upper": true
  },
  "Ќ": {
    "name": "KJE",
    "upper": true
  },
  "Ѝ": {
    "name": "I WITH GRAVE",
    "upper": true
  },
  "Ў": {
    "name": "SHORT U",
    "upper": true
  },
  "Џ": {
    "name": "DZHE",
    "upper": true
  },
  "А": {
    "name": "A",
    "upper": true
  },
  "Б": {
    "name": "BE",
    "upper": true
  },
  "В": {
    "name": "VE",
    "upper": true
  },
  "Г": {
    "name": "GHE",
    "upper": true
  },
  "Д": {
    "name": "DE",
    "upper": true
  },
  "Е": {
    "name": "IE",
    "upper": true
  },
  "Ж": {
    "name": "ZHE",
    "upper": true
  },
  "З": {
    "name": "ZE",
    "upper": true
  },
  "И": {
    "name": "I",
    "upper": true
  },
  "Й": {
    "name": "SHORT I",
    "upper": true
  },
  "К": {
    "name": "KA",
    "upper": true
  },
  "Л": {
    "name": "EL",
    "upper": true
  },
  "М": {
    "name": "EM",
    "upper": true
  },
  "Н": {
    "name": "EN",
    "upper": true
  },
  "О": {
    "name": "O",
    "upper": true
  },
  "П": {
    "name": "PE",
    "upper": true
  },
  "Р": {
    "name": "ER",
    "upper": true
  },
  "С": {
    "name": "ES",
    "upper": true
  },
  "Т": {
    "name": "TE",
    "upper": true
  },
  "У": {
    "name": "U",
    "upper": true
  },
  "Ф": {
    "name": "EF",
    "upper": true
  },
  "Х": {
    "name": "HA",
    "upper": true
  },
  "Ц": {
    "name": "TSE",
    "upper": true
  },
  "Ч": {
    "name": "CHE",
    "upper": true
  },
  "Ш": {
    "name": "SHA",
    "upper": true
  },
  "Щ": {
    "name": "SHCHA",
    "upper": true
  },
  "Ъ": {
    "name": "HARD SIGN",
    "upper": true
  },
  "Ы": {
    "name": "YERU",
    "upper": true
  },
  "Ь": {
    "name": "SOFT SIGN",
    "upper": true
  },
  "Э": {
    "name": "E",
    "upper": true
  },
  "Ю": {
    "name": "YU",
    "upper": true
  },
  "Я": {
    "name": "YA",
    "upper": true
  },
  "а": {
    "name": "A",
    "upper": false
  },
  "б": {
    "name": "BE",
    "upper": false
  },
  "в": {
    "name": "VE",
    "upper": false
  },
  "г": {
    "name": "GHE",
    "upper": false
  },
  "д": {
    "name": "DE",
    "upper": false
  },
  "е": {
    "name": "IE",
    "upper": false
  },
  "ж": {
    "name": "ZHE",
    "upper": false
  },
  "з": {
    "name": "ZE",
    "upper": false
  },
  "и": {
    "name": "I",
    "upper": false
  },
  "й": {
    "name": "SHORT I",
    "upper": false
  },
  "к": {
    "name": "KA",
    "upper": false
  },
  "л": {
    "name": "EL",
    "upper": false
  },
  "м": {
    "name": "EM",
    "upper": false
  },
  "н": {
    "name": "EN",
    "upper": false
  },
  "о": {
    "name": "O",
    "upper": false
  },
  "п": {
    "name": "PE",
    "upper": false
  },
  "р": {
    "name": "ER",
    "upper": false
  },
  "с": {
    "name": "ES",
    "upper": false
  },
  "т": {
    "name": "TE",
    "upper": false
  },
  "у": {
    "name": "U",
    "upper": false
  },
  "ф": {
    "name": "EF",
    "upper": false
  },
  "х": {
    "name": "HA",
    "upper": false
  },
  "ц": {
    "name": "TSE",
    "upper": false
  },
  "ч": {
    "name": "CHE",
    "upper": false
  },
  "ш": {
    "name": "SHA",
    "upper": false
  },
  "щ": {
    "name": "SHCHA",
    "upper": false
  },
  "ъ": {
    "name": "HARD SIGN",
    "upper": false
  },
  "ы": {
    "name": "YERU",
    "upper": false
  },
  "ь": {
    "name": "SOFT SIGN",
    "upper": false
  },
  "э": {
    "name": "E",
    "upper": false
  },
  "ю": {
    "name": "YU",
    "upper": false
  },
  "я": {
    "name": "YA",
    "upper": false
  },
  "ѐ": {
    "name": "IE WITH GRAVE",
    "upper": false
  },
  "ё": {
    "name": "IO",
    "upper": false
  },
  "ђ": {
    "name": "DJE",
    "upper": false
  },
  "ѓ": {
    "name": "GJE",
    "upper": false
  },
  "є": {
    "name": "UKRAINIAN IE",
    "upper": false
  },
  "ѕ": {
    "name": "DZE",
    "upper": false
  },
  "і": {
    "name": "BYELORUSSIAN-UKRAINIAN I",
    "upper": false
  },
  "ї": {
    "name": "YI",
    "upper": false
  },
  "ј": {
    "name": "JE",
    "upper": false
  },
  "љ": {
    "name": "LJE",
    "upper": false
  },
  "њ": {
    "name": "NJE",
    "upper": false
  },
  "ћ": {
    "name": "TSHE",
    "upper": false
  },
  "ќ": {
    "name": "KJE",
    "upper": false
  },
  "ѝ": {
    "name": "I WITH GRAVE",
    "upper": false
  },
  "ў": {
    "name": "SHORT U",
    "upper": false
  },
  "џ": {
    "name": "DZHE",
    "upper": false
  },
  "Ѡ": {
    "name": "OMEGA",
    "upper": true
  },
  "ѡ": {
    "name": "OMEGA",
    "upper": false
  },
  "Ѣ": {
    "name": "YAT",
    "upper": true
  },
  "ѣ": {
    "name": "YAT",
    "upper": false
  },
  "Ѥ": {
    "name": "IOTIFIED E",
    "upper": true
  },
  "ѥ": {
    "name": "IOTIFIED E",
    "upper": false
  },
  "Ѧ": {
    "name": "LITTLE YUS",
    "upper": true
  },
  "ѧ": {
    "name": "LITTLE YUS",
    "upper": false
  },
  "Ѩ": {
    "name": "IOTIFIED LITTLE YUS",
    "upper": true
  },
  "ѩ": {
    "name": "IOTIFIED LITTLE YUS",
    "upper": false
  },
  "Ѫ": {
    "name": "BIG YUS",
    "upper": true
  },
  "ѫ": {
    "name": "BIG YUS",
    "upper": false
  },
  "Ѭ": {
    "name": "IOTIFIED BIG YUS",
    "upper": true
  },
  "ѭ": {
    "name": "IOTIFIED BIG YUS",
    "upper": false
  },
  "Ѯ": {
    "name": "KSI",
    "upper": true
  },
  "ѯ": {
    "name": "KSI",
    "upper": false
  },
  "Ѱ": {
    "name": "PSI",
    "upper": true
  },
  "ѱ": {
    "name": "PSI",
    "upper": false
  },
  "Ѳ": {
    "name": "FITA",
    "upper": true
  },
  "ѳ": {
    "name": "FITA",
    "upper": false
  },
  "Ѵ": {
    "name": "IZHITSA",
    "upper": true
  },
  "ѵ": {
    "name": "IZHITSA",
    "upper": false
  },
  "Ѷ": {
    "name": "IZHITSA WITH DOUBLE GRAVE ACCENT",
    "upper": true
  },
  "ѷ": {
    "name": "IZHITSA WITH DOUBLE GRAVE ACCENT",
    "upper": false
  },
  "Ѹ": {
    "name": "UK",
    "upper": true
  },
  "ѹ": {
    "name": "UK",
    "upper": false
  },
  "Ѻ": {
    "name": "ROUND OMEGA",
    "upper": true
  },
  "ѻ": {
    "name": "ROUND OMEGA",
    "upper": false
  },
  "Ѽ": {
    "name": "OMEGA WITH TITLO",
    "upper": true
  },
  "ѽ": {
    "name": "OMEGA WITH TITLO",
    "upper": false
  },
  "Ѿ": {
    "name": "OT",
    "upper": true
  },
  "ѿ": {
    "name": "OT",
    "upper": false
  },
  "Ҁ": {
    "name": "KOPPA",
    "upper": true
  },
  "ҁ": {
    "name": "KOPPA",
    "upper": false
  },
  "Ҋ": {
    "name": "SHORT I WITH TAIL",
    "upper": true
  },
  "ҋ": {
    "name": "SHORT I WITH TAIL",
    "upper": false
  },
  "Ҍ": {
    "name": "SEMISOFT SIGN",
    "upper": true
  },
  "ҍ": {
    "name": "SEMISOFT SIGN",
    "upper": false
  },
  "Ҏ": {
    "name": "ER WITH TICK",
    "upper": true
  },
  "ҏ": {
    "name": "ER WITH TICK",
    "upper": false
  },
  "Ґ": {
    "name": "GHE WITH UPTURN",
    "upper": true
  },
  "ґ": {
    "name": "GHE WITH UPTURN",
    "upper": false
  },
  "Ғ": {
    "name": "GHE WITH STROKE",
    "upper": true
  },
  "ғ": {
    "name": "GHE WITH STROKE",
    "upper": false
  },
  "Ҕ": {
    "name": "GHE WITH MIDDLE HOOK",
    "upper": true
  },
  "ҕ": {
    "name": "GHE WITH MIDDLE HOOK",
    "upper": false
  },
  "Җ": {
    "name": "ZHE WITH DESCENDER",
    "upper": true
  },
  "җ": {
    "name": "ZHE WITH DESCENDER",
    "upper": false
  },
  "Ҙ": {
    "name": "ZE WITH DESCENDER",
    "upper": true
  },
  "ҙ": {
    "name": "ZE WITH DESCENDER",
    "upper": false
  },
  "Қ": {
    "name": "KA WITH DESCENDER",
    "upper": true
  },
  "қ": {
    "name": "KA WITH DESCENDER",
    "upper": false
  },
  "Ҝ": {
    "name": "KA WITH VERTICAL STROKE",
    "upper": true
  },
  "ҝ": {
    "name": "KA WITH VERTICAL STROKE",
    "upper": false
  },
  "Ҟ": {
    "name": "KA WITH STROKE",
    "upper": true
  },
  "ҟ": {
    "name": "KA WITH STROKE",
    "upper": false
  },
  "Ҡ": {
    "name": "BASHKIR KA",
    "upper": true
  },
  "ҡ": {
    "name": "BASHKIR KA",
    "upper": false
  },
  "Ң": {
    "name": "EN WITH DESCENDER",
    "upper": true
  },
  "ң": {
    "name": "EN WITH DESCENDER",
    "upper": false
  },
  "Ҥ": {
    "name": "EN GHE",
    "upper": true,
    "ligature": true
  },
  "ҥ": {
    "name": "EN GHE",
    "upper": false,
    "ligature": true
  },
  "Ҧ": {
    "name": "PE WITH MIDDLE HOOK",
    "upper": true
  },
  "ҧ": {
    "name": "PE WITH MIDDLE HOOK",
    "upper": false
  },
  "Ҩ": {
    "name": "ABKHASIAN HA",
    "upper": true
  },
  "ҩ": {
    "name": "ABKHASIAN HA",
    "upper": false
  },
  "Ҫ": {
    "name": "ES WITH DESCENDER",
    "upper": true
  },
  "ҫ": {
    "name": "ES WITH DESCENDER",
    "upper": false
  },
  "Ҭ": {
    "name": "TE WITH DESCENDER",
    "upper": true
  },
  "ҭ": {
    "name": "TE WITH DESCENDER",
    "upper": false
  },
  "Ү": {
    "name": "STRAIGHT U",
    "upper": true
  },
  "ү": {
    "name": "STRAIGHT U",
    "upper": false
  },
  "Ұ": {
    "name": "STRAIGHT U WITH STROKE",
    "upper": true
  },
  "ұ": {
    "name": "STRAIGHT U WITH STROKE",
    "upper": false
  },
  "Ҳ": {
    "name": "HA WITH DESCENDER",
    "upper": true
  },
  "ҳ": {
    "name": "HA WITH DESCENDER",
    "upper": false
  },
  "Ҵ": {
    "name": "TE TSE",
    "upper": true,
    "ligature": true
  },
  "ҵ": {
    "name": "TE TSE",
    "upper": false,
    "ligature": true
  },
  "Ҷ": {
    "name": "CHE WITH DESCENDER",
    "upper": true
  },
  "ҷ": {
    "name": "CHE WITH DESCENDER",
    "upper": false
  },
  "Ҹ": {
    "name": "CHE WITH VERTICAL STROKE",
    "upper": true
  },
  "ҹ": {
    "name": "CHE WITH VERTICAL STROKE",
    "upper": false
  },
  "Һ": {
    "name": "SHHA",
    "upper": true
  },
  "һ": {
    "name": "SHHA",
    "upper": false
  },
  "Ҽ": {
    "name": "ABKHASIAN CHE",
    "upper": true
  },
  "ҽ": {
    "name": "ABKHASIAN CHE",
    "upper": false
  },
  "Ҿ": {
    "name": "ABKHASIAN CHE WITH DESCENDER",
    "upper": true
  },
  "ҿ": {
    "name": "ABKHASIAN CHE WITH DESCENDER",
    "upper": false
  },
  "Ӏ": {
    "name": "PALOCHKA",
    "upper": true
  },
  "Ӂ": {
    "name": "ZHE WITH BREVE",
    "upper": true
  },
  "ӂ": {
    "name": "ZHE WITH BREVE",
    "upper": false
  },
  "Ӄ": {
    "name": "KA WITH HOOK",
    "upper": true
  },
  "ӄ": {
    "name": "KA WITH HOOK",
    "upper": false
  },
  "Ӆ": {
    "name": "EL WITH TAIL",
    "upper": true
  },
  "ӆ": {
    "name": "EL WITH TAIL",
    "upper": false
  },
  "Ӈ": {
    "name": "EN WITH HOOK",
    "upper": true
  },
  "ӈ": {
    "name": "EN WITH HOOK",
    "upper": false
  },
  "Ӊ": {
    "name": "EN WITH TAIL",
    "upper": true
  },
  "ӊ": {
    "name": "EN WITH TAIL",
    "upper": false
  },
  "Ӌ": {
    "name": "KHAKASSIAN CHE",
    "upper": true
  },
  "ӌ": {
    "name": "KHAKASSIAN CHE",
    "upper": false
  },
  "Ӎ": {
    "name": "EM WITH TAIL",
    "upper": true
  },
  "ӎ": {
    "name": "EM WITH TAIL",
    "upper": false
  },
  "ӏ": {
    "name": "PALOCHKA",
    "upper": false
  },
  "Ӑ": {
    "name": "A WITH BREVE",
    "upper": true
  },
  "ӑ": {
    "name": "A WITH BREVE",
    "upper": false
  },
  "Ӓ": {
    "name": "A WITH DIAERESIS",
    "upper": true
  },
  "ӓ": {
    "name": "A WITH DIAERESIS",
    "upper": false
  },
  "Ӕ": {
    "name": "A IE",
    "upper": true,
    "ligature": true
  },
  "ӕ": {
    "name": "A IE",
    "upper": false,
    "ligature": true
  },
  "Ӗ": {
    "name": "IE WITH BREVE",
    "upper": true
  },
  "ӗ": {
    "name": "IE WITH BREVE",
    "upper": false
  },
  "Ә": {
    "name": "SCHWA",
    "upper": true
  },
  "ә": {
    "name": "SCHWA",
    "upper": false
  },
  "Ӛ": {
    "name": "SCHWA WITH DIAERESIS",
    "upper": true
  },
  "ӛ": {
    "name": "SCHWA WITH DIAERESIS",
    "upper": false
  },
  "Ӝ": {
    "name": "ZHE WITH DIAERESIS",
    "upper": true
  },
  "ӝ": {
    "name": "ZHE WITH DIAERESIS",
    "upper": false
  },
  "Ӟ": {
    "name": "ZE WITH DIAERESIS",
    "upper": true
  },
  "ӟ": {
    "name": "ZE WITH DIAERESIS",
    "upper": false
  },
  "Ӡ": {
    "name": "ABKHASIAN DZE",
    "upper": true
  },
  "ӡ": {
    "name": "ABKHASIAN DZE",
    "upper": false
  },
  "Ӣ": {
    "name": "I WITH MACRON",
    "upper": true
  },
  "ӣ": {
    "name": "I WITH MACRON",
    "upper": false
  },
  "Ӥ": {
    "name": "I WITH DIAERESIS",
    "upper": true
  },
  "ӥ": {
    "name": "I WITH DIAERESIS",
    "upper": false
  },
  "Ӧ": {
    "name": "O WITH DIAERESIS",
    "upper": true
  },
  "ӧ": {
    "name": "O WITH DIAERESIS",
    "upper": false
  },
  "Ө": {
    "name": "BARRED O",
    "upper": true
  },
  "ө": {
    "name": "BARRED O",
    "upper": false
  },
  "Ӫ": {
    "name": "BARRED O WITH DIAERESIS",
    "upper": true
  },
  "ӫ": {
    "name": "BARRED O WITH DIAERESIS",
    "upper": false
  },
  "Ӭ": {
    "name": "E WITH DIAERESIS",
    "upper": true
  },
  "ӭ": {
    "name": "E WITH DIAERESIS",
    "upper": false
  },
  "Ӯ": {
    "name": "U WITH MACRON",
    "upper": true
  },
  "ӯ": {
    "name": "U WITH MACRON",
    "upper": false
  },
  "Ӱ": {
    "name": "U WITH DIAERESIS",
    "upper": true
  },
  "ӱ": {
    "name": "U WITH DIAERESIS",
    "upper": false
  },
  "Ӳ": {
    "name": "U WITH DOUBLE ACUTE",
    "upper": true
  },
  "ӳ": {
    "name": "U WITH DOUBLE ACUTE",
    "upper": false
  },
  "Ӵ": {
    "name": "CHE WITH DIAERESIS",
    "upper": true
  },
  "ӵ": {
    "name": "CHE WITH DIAERESIS",
    "upper": false
  },
  "Ӷ": {
    "name": "GHE WITH DESCENDER",
    "upper": true
  },
  "ӷ": {
    "name": "GHE WITH DESCENDER",
    "upper": false
  },
  "Ӹ": {
    "name": "YERU WITH DIAERESIS",
    "upper": true
  },
  "ӹ": {
    "name": "YERU WITH DIAERESIS",
    "upper": false
  },
  "Ӻ": {
    "name": "GHE WITH STROKE AND HOOK",
    "upper": true
  },
  "ӻ": {
    "name": "GHE WITH STROKE AND HOOK",
    "upper": false
  },
  "Ӽ": {
    "name": "HA WITH HOOK",
    "upper": true
  },
  "ӽ": {
    "name": "HA WITH HOOK",
    "upper": false
  },
  "Ӿ": {
    "name": "HA WITH STROKE",
    "upper": true
  },
  "ӿ": {
    "name": "HA WITH STROKE",
    "upper": false
  }
});
