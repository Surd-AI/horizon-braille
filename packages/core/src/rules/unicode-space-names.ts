/** Unicode 18.0 Zs spaces other than existing ASCII/ideographic spaces.
 * Layout identity descriptions preserve width/nonbreaking names without assigning print widths to Braille cells.
 * Source: https://www.unicode.org/Public/18.0.0/ucd/UnicodeData.txt */
export const UNICODE_SPACE_NAMES:Readonly<Record<string,string>>=Object.freeze({
  " ": "NO-BREAK SPACE",
  " ": "OGHAM SPACE MARK",
  " ": "EN QUAD",
  " ": "EM QUAD",
  " ": "EN SPACE",
  " ": "EM SPACE",
  " ": "THREE-PER-EM SPACE",
  " ": "FOUR-PER-EM SPACE",
  " ": "SIX-PER-EM SPACE",
  " ": "FIGURE SPACE",
  " ": "PUNCTUATION SPACE",
  " ": "THIN SPACE",
  " ": "HAIR SPACE",
  " ": "NARROW NO-BREAK SPACE",
  " ": "MEDIUM MATHEMATICAL SPACE"
});
