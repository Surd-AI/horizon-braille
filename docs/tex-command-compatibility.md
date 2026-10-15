# Additional standard TeX command adapters

## Transparent TeX break hints

The zero-width `nobreak` and `allowbreak` commands are recognized as print-layout hints following the primary [KaTeX symbol definitions](https://raw.githubusercontent.com/KaTeX/KaTeX/main/src/symbols.ts). Formula content and original hint spans remain intact. An informational diagnostic records the adaptation; hints do not invent mathematical symbols or override the checked Braille line-breaking profile. Bare-formula recognition skips these hints without rewriting source, using a bounded sticky scan, including repeated hints. Hint-like command prefixes remain unknown. Inputs containing only hints retain the visible empty-content source transcription rather than disappearing.

## Visible source for empty or space-only domains

An explicitly selected domain or a recognized document math field with no nonblank encoded cells retains a visible review marker and a protected “排版原文” caption with literal source. This covers empty native font scopes and spacing/formatting-only scopes, including Braille blank cells that would otherwise look like no result. Original wrappers, UTF-16 offsets and actual CR/LF line boundaries remain intact. Intentional empty/whitespace editor input remains empty. Real formulas with spacing and existing readable spacing-length annotations retain their normal conversion. Literal transcription is a correction aid, not a verified mathematical expression, so `math-empty-expression` and incomplete status remain available.

## Declared Greek form identities

The six declared `varepsilon`, `varphi`, `vartheta`, `varrho`, `varsigma` and `varpi` commands retain the underlying Greek letter and inherited font with a readable Greek-form caption and the exact original command name. This keeps standard and declared variant variables distinct in the same expression, different document math fields, aligned rows and matrix cells. A lone declared form also retains its name instead of silently flattening into the standard variable. The command identities follow the primary [KaTeX symbol definitions](https://raw.githubusercontent.com/KaTeX/KaTeX/main/src/symbols.ts). This is an editorial source-name identity profile, not a new native Greek-form sign or a claim that previously unsupported Unicode glyphs are now natively mapped.

Native letter payloads and fonts retain their existing points. Role/name captions remain protected from Chinese word edits. The strict `review-unmapped` symbol policy retains the letter and name while requiring review. The old internal `greekVariantConflicts` parsing option remains accepted for compatibility but is no longer needed: names retain their own identities across independent parsing scopes. Previously unlisted mathematical Unicode variants retain the existing visible review path.

## Declared operator bodies

The `mathop` primitive consumes one ordinary math argument (one atom or a braced expression), retaining its parsed expression, original body spans and inherited fonts under a readable operator-role caption. It does not turn the body into a guessed function name. Default side-script behavior and explicit `limits`/`nolimits` switches follow the primary [KaTeX operator implementation](https://raw.githubusercontent.com/KaTeX/KaTeX/main/src/functions/op.ts); no display-size growth or new native GB operator sign is inferred. Existing lower/upper limit fields and ordinary scripts remain distinct. Document-mode formula detection recognizes the same argument scope.

Empty bodies and unsupported nested commands keep visible frames/content and review markers. Native matrix placement checks remain conservative inside operator bodies. Chinese source-word braille edits retain protected role captions. The `review-unmapped` symbol policy retains the body while reviewing the editorial caption.

## Cyrillic letter and ligature identity descriptions

All 248 uppercase/lowercase letters and ligatures in U+0400–04FF retain readable Cyrillic/case/letter-or-ligature captions and the exact official character name from [Unicode 18.0 UnicodeData](https://www.unicode.org/Public/18.0.0/ucd/UnicodeData.txt). Fixed Chinese captions and individual name words retain separate protected groups for narrow reflow. This is an editorial identity profile, not Russian/Ukrainian language braille or inferred pronunciation/transliteration. Lookalike Latin letters are never substituted; source glyphs and UTF-16 spans remain unchanged. Literal TeX fields, explicit math fields and Chinese aligned text use the same description profile. Combining marks, the thousands sign and Cyrillic extensions outside this finite block retain their existing review paths. Unicode License V3 is retained in THIRD-PARTY-NOTICES.md.

## Literal numeric glyph descriptions

A finite table preserves 32 uppercase/lowercase Roman numeral glyphs, seven archaic Roman number forms, and 20 superscript/subscript digit glyphs in literal text. Readable captions retain the numeric value and case or script position; Roman spellings are retained, while archaic forms retain their Unicode identity. These are editorial descriptions, not new native GB signs. Formula-level Unicode scripts keep the existing native superscript/subscript profile.

The table follows the primary Unicode [Number Forms](https://www.unicode.org/charts/PDF/U2150.pdf) and [Superscripts and Subscripts](https://www.unicode.org/charts/PDF/U2070.pdf) charts. No compatibility normalization or Roman string arithmetic is inferred. Reversed C forms U+2183/U+2184, fraction glyphs and script letters are excluded from this numeric table and retain the existing review path. Original glyphs and source spans remain unchanged, including literal formula fields and Chinese aligned text.

## Source-bound Markdown emphasis

Matched asterisk/underscore emphasis and strong emphasis retain explicit readable start/end captions and exact marker spans. Pairing uses Unicode flanking, underscore intraword restrictions and delimiter rule-of-three from the primary [CommonMark emphasis specification](https://spec.commonmark.org/0.31.2/#emphasis-and-strong-emphasis). Nested runs retain separate boundaries, including triple delimiters. Structural blocks/paragraphs constrain pairing; code and explicitly delimited mathematics remain opaque, and braces inside detected TeX fields protect their literal markers.

Matched markers become stop boundaries only in the internal bare-formula recognition view; the source and node raw values remain unchanged. Bare candidates stop at emphasis boundaries, so a closing marker and following outside text cannot be swallowed into the formula. Escaped delimiters remain literal. Marker captions have distinct source-bound groups and fixed captions are reused per conversion; pairing has a linear-sized work budget and retains unmatched input for review if exhausted. Chinese edits preserve captions and source offsets. This does not assert full CommonMark link/HTML/container conformance or infer a native GB font from rendered emphasis.

## Explicit Markdown quote prefixes and quoted code

Document mode retains explicit line-start blockquote prefixes with their nesting depth and source indentation under readable “引用层级” captions. ATX headings, list markers, separators and formulas inside the explicit prefix continue through their existing adapters. Literal math comparisons, escaped greater-than signs and inline greater-than characters are not promoted to quote prefixes. Prefix recognition follows the primary [CommonMark blockquote specification](https://spec.commonmark.org/0.31.2/#block-quotes); this source-marker profile does not claim full CommonMark container/lazy-continuation rendering.

Quoted fenced code consumes exactly its explicit container depth on each line. Source prefix spans receive protected captions; the remaining code data is transcribed literally without math recognition or execution. Additional greater-than characters remain actual code content. If the container ends before a closing fence, literal content remains visible for review and the following unquoted document is still parsed. Source is never stripped or rewritten, including CRLF, empty quote lines and nested prefixes. Existing marker-disable/plain-text modes and Chinese source word edits remain available.

## Structured named operators and empty fraction operands

Named-operator bodies containing TeX commands/groups now use the existing mathematical parser with the original body offsets and resource-depth budget. Nested fonts, functions, annotations and Chinese text retain their fields under the outer role description, matching the argument-expression semantics of the primary [KaTeX operatorname implementation](https://raw.githubusercontent.com/KaTeX/KaTeX/main/src/functions/operatorname.ts). Unknown commands and empty/format-only bodies remain incomplete. Matrix placement checks still apply inside named operators; structured content is not permission to silently accept unchecked nested matrices.

Fraction fields and radicands containing only empty groups, whitespace text or formatting no longer claim complete conversion. Each missing operand retains a visible marker in its original field, with an explicit review diagnostic; existing operands and neighboring formula content still convert. Empty optional root indices remain optional. This repairs a false-complete classification, so newly flagged malformed corpus inputs must be reported separately from unintended conversion regressions.

## Explicit named-operator descriptions

`operatorname` retains checked native function transcriptions where available. Other literal letter/digit/space names retain their exact case and a scoped “命名运算符” description, preserving operator identity rather than silently presenting ordinary variable/text content. Empty names, macros and unverified punctuation syntax remain visible and incomplete; unsupported scripts preserve their existing character identifiers and review status.

The starred form retains explicit lower/upper-limit positions, including existing native named functions; `limits`/`nolimits` override the explicit named-operator limit mode. Behavior follows the primary [KaTeX operatorname implementation](https://raw.githubusercontent.com/KaTeX/KaTeX/main/src/functions/operatorname.ts). This preserves role and field placement, without inventing a new GB abbreviated-function sign or inferring an operator definition/arity. Source offsets and editable Chinese names remain retained, while synthetic role captions stay read-only. Native-only symbol review keeps the described names flagged.

## Unsupported literal-character identity retention

The literal-text fallback retains the existing unresolved marker plus a readable “原文字符” caption and exact hexadecimal Unicode identifier. Different unsupported letters, script glyphs, emoji, combining marks and format characters no longer collapse to the same placeholder-only output. Lone surrogate code units use `UTF16+` identifiers rather than claiming valid Unicode scalar characters.

The original error/unhandled item remains and conversion stays incomplete. Identifiers are source transcription, not pronunciation, script-specific braille or mathematical meaning. Synthetic captions/code identifiers remain read-only and use the exact original UTF-16 span, including supplementary characters. Nearby supported formulas and Chinese manual word edits remain retained; long outputs can reflow across caption/code groups without losing source identity.

## Literal accented Latin glyphs

Literal prose/math text retains canonically decomposable Latin letters in U+00C0–U+024F and U+1E00–U+1EFF when decomposition is one ASCII Latin base plus at most three explicitly described marks. Each description preserves the base case and all supported marks in canonical order. Evidence is the primary Unicode [Latin-1 chart](https://www.unicode.org/charts/PDF/U0080.pdf), [combining-mark chart](https://www.unicode.org/charts/PDF/U0300.pdf) and [canonical normalization specification](https://www.unicode.org/reports/tr15/).

This is readable glyph transcription, not a foreign-language braille alphabet or pronunciation rule. Source is never normalized or replaced. NFKC/NFKD, ligatures, stroked letters, other scripts, arbitrary standalone combining marks and unsupported mark sequences are not flattened into ASCII. Synthetic descriptions are read-only and retain the original character span; adjacent Chinese word edits and formula fields remain separate. This prose adapter does not reinterpret bare mathematical accented variables as ordinary Latin letters.

## Negative/diagonal arrows and further glyphs

Readable glyph descriptions retain six struck single/double-line left/right/bidirectional arrows, four diagonal arrows, `permil`, `sphericalangle`, `daleth`, `backsim`, `bigtriangleup` and `asymp`. Matching Unicode forms are recognized except that the explicitly sized `bigtriangleup` command stays distinct from the existing native ordinary triangle glyph. Descriptions preserve direction, line count, strike and shape without assuming a particular logical or algebraic use. The Hebrew letter retains its family plus the literal name `daleth`, rather than being silently treated as a Latin variable.

Command identity follows the primary [KaTeX support table](https://katex.org/docs/support_table.html); `permil` is documented in the primary [wasysym manual](https://ftp.cvut.cz/tex-archive/macros/latex/contrib/wasysym/wasysym.pdf). `varvdots` reuses the existing checked vertical-ellipsis profile: the primary [KaTeX symbol definitions](https://raw.githubusercontent.com/KaTeX/KaTeX/main/src/symbols.ts) identify its glyph, and the amsmath macro implementation uses it for `vdots`. Original source spans, nested fields, editable Chinese source words and unknown neighbors remain retained. Descriptions are editorial transcriptions; native-only review still marks them unresolved.

## Scoped color source descriptions

`color` consumes its braced literal specification and the following current scope; `textcolor` consumes the specification and one mathematical argument. Scope follows the primary [KaTeX color implementation](https://raw.githubusercontent.com/KaTeX/KaTeX/main/src/functions/color.ts). Nested colors, braces and matching right delimiters retain their boundaries; color does not replace the underlying mathematical font.

Encoding retains “颜色原文” plus the exact color name/hex spelling inside a readable scope frame. This is an editorial source description, not color lookup, rendered color, macro execution or a newly certified native GB sign. Alphabetic custom names are retained literally without claiming that a color registry resolves them. Empty bodies/names, missing braces, macros, mixes/models and declarations used as unbraced macro arguments remain visible for review. Editable Chinese body words stay separate from read-only color specifications/captions; original source offsets remain intact.

## Additional glyphs and simulated bold

Readable symbol descriptions cover `vdash`, `hookrightarrow/hookleftarrow`, `leadsto/rightsquigarrow`, `sharp/flat/natural`, standalone `surd`, `sqcup/sqcap` and `ni/owns`, including their matching Unicode glyphs. Identity follows the primary [KaTeX support table](https://katex.org/docs/support_table.html). Descriptions preserve orientation and glyph distinctions without inferring a particular logical, algebraic or musical use. `surd` is a standalone sign and does not invent or consume a radicand. Native-only symbol review keeps these descriptions flagged.

`pmb` retains its full one-argument body with a scoped “模拟粗体” caption. The underlying font remains inherited, including an enclosing italic/native font; this avoids equating simulated overprinting with a new font family or certified native bold sign. Empty/unknown bodies remain visible for review. Source spans, nested formula fields and editable Chinese body words remain retained, while synthetic glyph/font captions remain read-only.

## Multiline substack fields

`substack` takes one argument, matching the primary [KaTeX amsmath macro definition](https://raw.githubusercontent.com/KaTeX/KaTeX/main/src/macros.ts). Top-level row separators split its body into ordered source-bound fields; nested groups and environments retain their own separators. Encoding uses an explicit readable “多行内容” frame and “换行” boundary captions inside the current mathematical field, rather than matrix notation or separate display equations. The captions are an editorial layout description, not a new native GB matrix/stack sign.

Lower/upper-limit placement, fractions, scripts and Chinese source word metadata remain retained. Unbraced arguments consume one token. Empty rows, unknown content, extra alignment columns, unclosed groups and unverified optional row spacing remain visible and incomplete. Structural matrix checks still apply to actual nested matrices. The existing resource-depth limit bounds recursive stacked fields; manual word edits preserve synthetic captions.

## Intercal transpose and described accents

`intercal` and Unicode `⊺` retain their glyph identity. In the existing guarded superscript transpose position they use the checked §6.17 transpose profile, matching superscript `top`; ordinary binary/standalone and numeric-base positions instead retain a readable glyph description. Source spelling remains unchanged. This does not reinterpret every occurrence as a matrix transpose.

`acute`, `grave` and `mathring` take one mathematical argument and retain distinct readable mark descriptions in an explicit above-annotation field. Compound bodies use the existing position-annotation grouping; unbraced arguments consume only one token. Syntax/glyph identity follows the primary [KaTeX accent and operator reference](https://katex.org/docs/supported.html). Descriptions do not invent GB accent point signs. Empty/unknown bodies remain incomplete and visible, and `review-unmapped` retains described marks for review. Chinese body words remain editable independently of the synthetic mark captions.

## Described large operators

`bigoplus`, `bigotimes`, `bigodot`, `bigwedge`, `bigvee`, `coprod`, `biguplus` and `bigsqcup` retain distinct readable glyph descriptions, including their direct Unicode forms. Command identity and operator classification follow the primary [KaTeX big-operator reference](https://katex.org/docs/supported.html#big-operators). The descriptions do not assert new native GB signs or infer a particular algebraic interpretation of the glyph.

Subscripts and superscripts use the existing explicit lower/upper-limit field profile and retain compound field boundaries. Their large forms remain distinct from ordinary circle/wedge binary operators. `intop` uses the existing checked integral glyph and limit transcription; visual TeX positioning is linearized rather than reproduced. Original source, unknown limit content and editable Chinese words remain retained, including nested fractions, scripts and aligned rows. Native-only symbol review policy still flags the described symbols.

## Legacy font declarations

`rm`, `bf`, `it`, `sf`, `tt` and `cal` select the existing `mathrm`, `mathbf`, `mathit`, `mathsf`, `mathtt` and `mathcal` profiles for the following scope. Their declaration semantics follow the primary [KaTeX font implementation](https://raw.githubusercontent.com/KaTeX/KaTeX/main/src/functions/font.ts). They consume the remaining current group, rather than one argument; nested declarations override their inner scope and closing braces or matching right delimiters restore the surrounding font. Original spelling and source spans remain retained.

Native font signs reuse the checked letter profiles. Unmapped sans-serif/monospace families use the approved readable descriptions and remain pending with `review-unmapped`. Empty bodies, unknown inner commands, and declarations used as unbraced macro arguments remain visible for review. Existing one-argument `frak`, `Bbb` and `bold` aliases retain their original semantics.

## Plain-TeX right equation numbers

`eqno` retains the following label as a separate mathematical field, linearized after the equation with the existing equation-label separation. The complete suffix in the current scope is the label, so parentheses and additional label content are not mistaken for equation body text. Native syntax/role is documented by Victor Eijkhout's primary [TeX by Topic](https://texdoc.org/serve/TeXbyTopic.pdf/0), section 24.6. Label mathematics is encoded as mathematics rather than silently rewritten as a prose identifier.

The OCR adapter accepts the explicit number in bare mathematical input and numbered aligned rows; it does not claim a full TeX display-mode validator or physical right-margin placement. No number or parentheses are invented. Empty labels, unknown content, missing equation bodies and structurally invalid placements remain visible for review. Existing source offsets, row/end grouping and editable Chinese label text are retained.

## Operator variants and explicit glyph descriptions

`smallsetminus`, `smallint`, `shortmid` and `shortparallel` use the existing checked set-difference, integral, vertical-divider and parallel-line profiles. The parser normalizes their roles before encoding so small integrals retain the native integral index/limit behavior. Original command spelling remains in the source; their printed size variation does not introduce a new braille sign. Source glyph/command identity follows the primary [KaTeX support table](https://katex.org/docs/support_table.html).

Explicit `colon`, `thicksim/thickapprox` and ordinary/small `frown/smile` commands retain readable glyph/weight/form descriptions. The colon caption does not choose ratio versus mapping punctuation; existing contextual literal-colon rules stay unchanged. Arc direction/size and wave thickness stay distinct, without inferring a geometric or logical relationship. Source spans, formula fields and adjacent unknown content remain retained. These captions do not certify new native GB signs.

## Shape and checkmark commands

Readable glyph captions cover `checkmark`, `bigcirc`, `bigstar`, `diamond`, `Diamond/lozenge`, downward/left/right triangles, filled triangles in four directions, `blacksquare`, `bigtriangledown` and `vartriangle`. Command/glyph identities follow the primary [KaTeX support table](https://katex.org/docs/support_table.html). Captions retain fill, direction and command-specific size/variant distinctions; they do not assign truth, convolution, geometry or modal-logic meanings. Existing native `triangle`, `square` and uncertain ordinary star rules remain unchanged. The Unicode small triangle `▵` is not assumed equivalent to `vartriangle`, and the heavier checkmark `✔` remains unresolved.

`Diamond` and `lozenge` share the same glyph identity. Plain `○` and large `◯` remain distinct; `▽` uses the ordinary downward triangle description while the explicit big command retains its larger-form name. The source-bound groups remain inside fraction/script/aligned fields and synthetic names stay out of editable source-word metadata. Native-only review mode and unknown neighboring content retain unresolved markers. These are editorial readable descriptions, not newly certified native GB signs.

## Relative font-size declarations

`tiny`, `scriptsize`, `footnotesize`, `small`, `normalsize`, `large`, `Large`, `LARGE`, `huge` and `Huge` retain distinct readable size names. These are declarations applying to the following current scope, not one-argument font-family commands. Braces and matched `left/right` groups end the scope; an immediately following braced group does not end an otherwise unbraced declaration. Syntax and relative identities follow the primary [KaTeX size reference](https://katex.org/docs/supported.html#style-color-size-and-font). Actual physical point sizes and braille-cell dimensions are not inferred.

Size descriptions preserve the enclosing letter font, source-word offsets, formula fields and matrix row controls. They use the existing readable font-description profile and counters; those counters therefore include font-size captions. Later nested size declarations replace the following size scope, rather than accumulating physical sizes. The primary [KaTeX sizing implementation](https://github.com/KaTeX/KaTeX/blob/main/src/functions/sizing.ts) corroborates declaration parsing and nested replacement; it also notes that accepting these commands directly in mathematical expressions is a KaTeX extension. This adapter targets that OCR/KaTeX profile. Review mode keeps missing native size indicators unresolved. Empty scopes, unknown contents and an unbraced size command used as a macro's argument remain visible for review. General LaTeX text-mode size declarations and arbitrary size macros remain open work.

## Explicit horizontal spacing

`hspace` accepts bounded braced or unbraced literal signed decimal lengths with `em/ex/mu/pt/bp/pc/mm/cm/in/dd/cc/nd/nc/sp` units. The starred form retains its line-start preservation distinction. Syntax and unit identity follow the primary [KaTeX spacing/units reference](https://katex.org/docs/supported.html#spacing). This adapter emits a grouped readable layout annotation (“水平空白” or “行首空白”) and the complete original length spelling, instead of treating the length as mathematical operands or silently dropping it. Physical TeX distances are not mapped to a guessed number of braille cells.

Source-bound length atoms stay inside the original fraction/script/aligned field; generated captions do not enter editable source-word metadata. Missing, empty, malformed, macro-based or unsupported-unit lengths remain visible and incomplete. General TeX glue/stretch/shrink and relative length macros remain open work. Existing fixed-spacing commands keep their established profile.

## Literal prose glyph descriptions

Literal degree sign, en dash, white circle, white upward triangle, black star, fullwidth tilde, caret and at sign retain distinct readable Chinese glyph names in prose and literal TeX text fields. Captions retain original source spans and protected groups; synthetic names do not become editable source words. Mathematical script syntax retains its existing interpretation. Describing the degree sign does not insert an angular/temperature unit, and describing a dash or triangle does not infer subtraction or a geometric variable. No new native GB point sign is asserted.

Glyph identity is checked against primary Unicode charts: [Basic Latin](https://www.unicode.org/charts/PDF/U0000.pdf), [Latin-1](https://www.unicode.org/charts/PDF/U0080.pdf), [General Punctuation](https://www.unicode.org/charts/PDF/U2000.pdf), [Geometric Shapes](https://www.unicode.org/charts/PDF/U25A0.pdf), [Miscellaneous Symbols](https://www.unicode.org/charts/PDF/U2600.pdf) and [Halfwidth/Fullwidth Forms](https://www.unicode.org/charts/PDF/UFF00.pdf). Unrecognized neighboring commands, foreign letters and distinct unsupported symbols remain visible for review. Standalone weak bare-TeX text remains subject to the existing document ambiguity policy; explicit math mode or delimiters establish a literal formula text field.

## Unicode circled decimal numerals

The white circled decimal numerals zero through fifty retain their complete decimal value followed by the checked §6.5.2.5 circle ending (`6,356`). The Unicode identity/ranges are bounded to `24EA`, `2460–2473`, `3251–325F` and `32B1–32BF`, checked against the primary [Enclosed Alphanumerics chart](https://www.unicode.org/charts/PDF/U2460.pdf) and [Enclosed CJK chart](https://www.unicode.org/charts/PDF/U3200.pdf). There is no global compatibility normalization. Black-filled, double-circle, parenthesized and dotted variants retain their unresolved source rather than losing their decoration.

Prose preserves the already published GF0019 Annex B lowered-digit encoding for ①–⑩. Other supported circled numerals use the mathematical circle frame with the ordinary decimal prefix; explicit mathematical text retains its text entry marker and mathematical circle frame. Every numeral/circle is one protected source unit, with original glyph offsets even for multi-digit values. The adapter does not treat circled labels as list counters or renumber them. Formula fractions, scripts, Chinese aligned rows, narrow layout and neighboring source-word edits retain their scopes and original source.

## Additional comparison, set and dotted relations

`leqq/geqq`, `lesssim/gtrsim`, `lessapprox/gtrapprox`, `subsetneq/supsetneq`, `subsetneqq/supsetneqq`, `subseteqq/supseteqq` and `doteq/Doteq/doteqdot` retain distinct readable glyph descriptions. Direction, single/double lower lines, single/double waves, strict-set variants and upper versus upper/lower dots remain distinct. Command/Unicode identity follows the primary [KaTeX support table](https://katex.org/docs/support_table.html); `Doteq` and `doteqdot` share the same glyph. These descriptions do not infer a context-specific definition, asymptotic bound or evaluation result, and do not assert new native GB point signs. Review mode retains unresolved markers. Existing checked ordinary comparisons and set signs remain unchanged. Compound formula fields, aligned Chinese prose and source-word spans have regression fixtures; unknown neighbors remain visible.

## Left and harpoon arrows

Standalone `leftarrow/longleftarrow`, `Leftarrow/Longleftarrow` and their Unicode spellings retain separate direction/line-style descriptions. Harpoon pairs retain their actual upper/lower order: `leftrightharpoons` is upper-left/lower-right and `rightleftharpoons` is upper-right/lower-left. Single harpoons retain left/right direction and upper/lower hook. The corresponding `x...` adapters preserve optional lower and required upper labels inside separate annotation scopes. Syntax/glyph identity follows the primary [KaTeX support table](https://katex.org/docs/support_table.html).

Descriptions identify glyphs without assigning chemical equilibrium, inverse-function or implication meanings. Checked above/below-position `leftarrow` cells retain precedence over descriptive standalone forms. `symbolPolicy: 'review-unmapped'` preserves unresolved standalone signs. Unknown labels remain visible with their original command spelling and diagnostics.

## Unsupported content remains visible

Unsupported units preserve their exact source and diagnostic spans while surrounding content continues to convert. Unknown control words also retain readable original spelling inside their formula field; other unknown units retain a visible review marker and the original source in the comparison/diagnostic view. Incomplete layout retains a display preview rather than clearing output. These results stay marked for review: retaining a source unit does not establish its mathematical meaning or checked braille cells.

Document candidates rejected by automatic formula recognition also retain a labelled literal-source transcription, including unknown command spelling, original word spans and line breaks. Original unresolved diagnostics and markers remain; later recognized formulas re-enter the mathematical profile correctly. This is source preservation rather than inferred macro interpretation. Resource-limit nodes are excluded from reprocessing so recovery cannot bypass the parser's input bound.

The editor separately guards background execution: a failed or hung worker falls back to the same local conversion, and the browser worker has a 15-second deadline. If local formula conversion itself throws, a labelled literal-source transcription remains visible and incomplete. Old failed requests cannot replace newer source, and missing alignment metadata cannot suppress an already encoded output line. The OCR page now exposes document/Markdown output as well as formula output. These fallbacks do not silently certify unsupported mathematical semantics.

Unknown environments retain their names and full literal bodies under an explicit “环境原文” caption instead of one placeholder for the whole block. Matching respects same-name nesting, escaped marker words and ordinary TeX comment lines; missing ends retain the whole remaining source. Original line breaks have source-bound readable markers, and actual Chinese body words remain editable without touching synthetic wrapper captions. Nearby supported expressions continue to convert. This is source transcription: unsupported bodies may contain drawing/program code, so their commands are not guessed to be mathematical expressions and the block stays incomplete.

Source syntax was checked against the primary [KaTeX supported-function reference](https://katex.org/docs/supported.html), consulted 2026-10-13. This reference establishes command syntax and roles; it does not establish braille cells. Cell rules below come from the locally inspected official GB/T 18028—2010 scans.

* `binom`, `dbinom` and `tbinom` represent binomial coefficients. The encoder normalizes their stacked presentation to `C` with the total as the lower index and selection as the upper index, following §6.10.1 and §6.10.2.1 (printed page 22). This is mathematical notation normalization, not exact visual reproduction. Original source and argument spans remain intact and `math-binomial-normalized` records the policy. Missing/empty arguments remain diagnosed. An outside exponent applies to the whole coefficient, with explicit parentheses preserving that scope.
* `deg`, `dim`, `hom`, `ker`, `Pr` and `gcd` are an explicit allowlist of standard named operators. Full Latin spelling uses §6.16.2.2 (printed page 31), including an initial capital for `Pr`. Unlisted macros are not inferred to be function names. Both math mode and document islands recognize these commands.
* `iff` and `implies` reuse the checked long equivalence and implication arrows under §6.8. The command source is preserved; no new glyph point patterns are introduced.
* `biggl/biggr/Biggl/Biggr`, the middle delimiter-sizing variants, and `middle` are formatting commands in math mode. Their following delimiters remain semantic payload. Paired left/right sizing wrappers are also recognized in document mode; arbitrary unpaired sizing commands are not automatically treated as whole formula islands.

Compound binomial arguments, nested fractions, external powers, text boundaries, incomplete arguments and source-span bounds have dedicated regression coverage. Corpus completeness remains distinct from independently reviewed braille accuracy.

## Explicit equation labels

`tag{label}` and `tag*{label}` retain literal prose identifiers, with parentheses added only by the unstarred command. Their syntax and per-row role are corroborated by [KaTeX's tag examples](https://katex.org/docs/supported.html#annotation) and its environment documentation. In the converter's linear editorial layout, a label appears after the expression in its row, separated by two blank cells. This is not a claim of a prescribed GB equation-number placement rule. Parentheses use the existing §6.3 cells and literal prose uses the existing text-in-mathematics encoding.

An early source tag is moved to the end of its semantic row without changing the source document or label offsets. Aligned equations retain their existing row separators. Each label stays atomic during wrapping. Chinese label words retain normal manual pronunciation/word-braille editing. Empty, unclosed, duplicate, standalone and structurally nested labels remain diagnosed and visible. Rich TeX macros inside a label continue through literal text diagnostics rather than being silently erased or guessed.

## Set relations and explicit negation

The independently inspected §6.18.1 table (printed page 38) and §6.18.2 spacing/examples (page 39) supply negative inclusion, double inclusion, ordering/preordering, bar-tailed mapping, bidirectional mapping and set difference glyphs. Corresponding TeX commands and Unicode forms retain those point patterns and spacing. Long-arrow and curved-equality spellings normalize glyph presentation only. This is not validation of set membership, surjectivity or bijectivity of the user's mathematical statement.

`not` consumes exactly one checked relation: equality, membership, subset, superset or existence. Its complete source span includes the prefix and target, while operands stay separate. The adapter reuses the listed negative glyph rather than applying a generic invented slash pattern. Other targets remain visible with `math-negation-unverified`. Syntax and Unicode spellings are corroborated by [KaTeX's supported-function reference](https://katex.org/docs/supported.html#negated-relations).

The bounded `F:A→B` mapping-colon form also accepts the corresponding long, bar-tailed and bidirectional arrows illustrated in §6.18.2 example 8. Local decisions remain source-bound and manual decisions take priority. Explicit math-mode options must remain present when collecting ambiguities from an encoded document; the core resolution pipeline and editor session now carry them through instead of treating that domain's text nodes as ordinary prose.

## Transpose, trace and vector names

Conventional single superscript `top`/`⊤` on a letter, styled letter, matrix or grouped expression normalizes to the transpose mark in §6.17.1 item 24 (`46,2345`, printed page 32). This is an editorial semantic normalization, not literal glyph/font reproduction. The convention is corroborated by the primary [top-Stein matrix-equation paper](https://arxiv.org/abs/1305.4243). Bare/subscript `top`, a numeric base and compound superscript content are not promoted through this adapter. An ordinary `T` exponent remains ordinary, and dagger/adjoint/pseudoinverse notation is not rewritten as transpose.

`Tr` and `SP` use the explicit trace spellings in §6.17.1 items 20–21. Their full-uppercase/initial-uppercase handling comes from that table; arbitrary uppercase operator names are not accepted on this basis. Source spelling remains intact.

Supported font wrappers retain their font while their one/two-letter vector name supplies the §6.15 arrow convention. Indexed vector names group the complete marked expression under §5.4.2.3. Exact literal `vec{0}` uses the complete zero-vector cells in §6.15.1 item 10 (`3456,245,45,25,2`) and the required following blank. Unsupported font and vector-name cases remain diagnosed. Original spans support manual word edits inside an indexed vector's literal Chinese label.

Scripted braced multi-term bases retain their scope with explicit parentheses in the linear braille representation, so `{A+B}` raised to an operation is not read as an operation on `B` alone. Unknown contextual symbols inside an index emit their review marker in that field instead of being relocated outside the index by later source-order recovery.

## Labeled arrows and explicit-domain scope

The checked-base extensible commands `xrightarrow`, `xRightarrow`, `xleftrightarrow`, `xLeftrightarrow`, `xmapsto` and `xlongequal` retain their base glyph with a required upper argument and optional lower bracket argument. Argument syntax is corroborated by [KaTeX extensible-arrow documentation](https://katex.org/docs/supported.html#extensible-arrows). Labels reuse the existing §6.5 above/below annotation encoder; both fields, original spans and manual Chinese-word edits remain available. Empty label groups add no invented text, while missing/unclosed/unknown content remains diagnosed. Other extensible arrow families still require checked base-glyph adapters.

A sole complete `$…$`, `$$…$$`, `\(…\)` or `\[…\]` wrapper is syntax even when the caller explicitly selects mathematics, physics or chemistry. Only its domain-parser input span is unwrapped; the original document and wrapper spans remain lossless. Unrelated surrounding content is not discarded. Empty and formatting-only wrapped expressions remain visibly incomplete.

Mathematical ambiguity collection now traverses the same whole-source, nested and aligned-row scopes as the encoder. A labeled mapping arrow retains the bounded mapping-colon role. This avoids treating a valid multiline declaration or aligned row as isolated text fragments with unrelated colon semantics; manual decisions keep priority.

## Font identity and Unicode mathematical letters

The six checked §5.2.2 letter-font classes retain native indicators. Known families without those signs (`mathbb`, `mathfrak`, `mathsf`, `mathtt` and the supported sans/fraktur variants) default to a visible Chinese font-name description plus the complete grouped body. This is explicit editorial transcription, **not a newly invented GB font sign** or a claim of exact TeX font fidelity. Double-struck, Fraktur, sans-serif and monospace identities remain distinct; no number-set, variable, constant or unit meaning is inferred from a font. The parser also retains the scopes of the `bm/bold/Bbb/frak/mathnormal` aliases. Source font semantics are corroborated by [KaTeX's font support table](https://katex.org/docs/support_table).

Braced `textit/textbf/textrm` preserve literal words, whitespace and nested inline mathematics. Styled prose uses the same visible scoped description; only real source words enter the editable Chinese-word metadata. Synthetic font labels have fixed readings, protected structural cells and source-bound command mappings. Unknown/empty body content remains unresolved within its own scope. `fontPolicy: 'review-unmapped'` keeps absent native signs/styled-prose typography flagged for manual review instead of using descriptions.

The bounded Unicode adapter covers Latin mathematical alphanumeric letter families, 240 regular Greek forms across five font families, and specified Letterlike compatibility slots from the [Unicode mathematical chart](https://www.unicode.org/charts/PDF/U1D400.pdf) and [Letterlike chart](https://unicode.org/charts/PDF/U2100.pdf). It retains both the letter and family in explicit math and automatic documents, including two-code-unit original spans. It does not normalize unrelated compatibility ligatures, styled Greek variants or mathematical digits. The bold-script letters use the checked handwritten-bold sign `3456`. Unmapped families reuse the visible description policy; they are not flattened to ordinary Latin letters.

## Inline mathematics inside text arguments

Literal `text`/`mbox`/`textcircled` arguments now also parse braced nested `textcircled` controls and escaped `%{}$#_&` characters. [KaTeX's support table](https://katex.org/docs/support_table.html) corroborates the TeX character/control syntax. Only checked character encodings become complete; unverified dollar/hash/underscore/ampersand glyphs retain full original escape spans and an unresolved marker. A decoded two-character escape maps every output atom/diagnostic/unresolved unit back to both original characters, rather than shifting subsequent Chinese word offsets. Nested enclosures keep their separate mathematical scope and preserve editable literal words. Depth bounds remain shared with inline mathematics. Automatic document detection accepts these explicit literal controls as TeX input while plain weak text remains under the existing ambiguity policy.

`text` and `mbox` retain ordinary text segments while parsing balanced single-dollar inline formulas inside their literal arguments. This syntax is documented by [KaTeX text documentation](https://katex.org/docs/supported.html#text). The outer document delimiter cannot close within a balanced TeX argument. Each inner formula retains its own mathematical scope; text/math transitions use the existing word and mathematical-in-text rules, including in aligned rows. Literal Chinese words keep exact original offsets and manual braille edits do not replace neighboring mathematical framing.

Escaped dollars do not open a formula. Empty, unclosed, unknown and depth-limited inner formulas remain visibly incomplete with original source retained. Display-dollar pairs inside a text argument are not promoted to nested inline formulas. Recursive parsing remains bounded; this adapter is not arbitrary TeX execution.

## Unsupported command source transcription

Unknown alphabetic control words retain a visible unresolved marker followed by a scoped readable caption, “原文命令”, and the exact Latin command spelling. Arguments and surrounding expressions continue through their existing encoders. This is literal source transcription, not an inferred mathematical meaning: the original source, diagnostic and incomplete status remain available for correction. Annotation/script positions retain the caption in their own field, and layout failure retains the display-only preview. Automatic document recognition still requires a recognizable formula scope; explicit math mode or complete math delimiters supply that scope.

Literal text punctuation lookup checks own properties, so names such as `constructor` cannot accidentally invoke inherited object values and abort conversion.

## Readable operator-glyph descriptions

`oplus`, `otimes`, `odot`, `ominus`, `oslash`, `bullet`, `wedge/land`, `vee/lor`, `dagger` and `ddagger` retain scoped Chinese glyph-name descriptions. Their corresponding Unicode glyphs use the same output. Macro/glyph identity and the wedge aliases are corroborated by the primary [KaTeX support table](https://katex.org/docs/support_table.html). The descriptions preserve the glyph identity without choosing among direct sum, exclusive-or, tensor product, exterior product, logical conjunction/disjunction, adjoint and other context-dependent meanings. In particular, circle glyphs do not collapse into ordinary arithmetic and dagger is not encoded as transpose.

Operands, fraction fields, indices, annotation direction, mixed-text alignment and original source spans remain intact. Generated captions do not become editable source words. These are readable editorial transcriptions, not asserted native GB operator signs; `symbolPolicy: 'review-unmapped'` retains manual review instead. Unknown neighboring expressions remain incomplete and visible.

## Floor/ceiling delimiters and vertical arrows

`lfloor/rfloor` and `lceil/rceil`, including `⌊⌋⌈⌉` and size-command forms, retain distinct readable names for the left/right floor/ceiling boundaries. Their syntax/glyph identities are corroborated by [KaTeX delimiter documentation](https://katex.org/docs/supported.html#delimiters). The encoder preserves the expression inside the boundaries, nested rounding pairs, negative operands, external scripts, postfix factorials, fractions and aligned mixed text. Ordinary TeX groups and font wrappers do not sever a delimiter pair on the same mathematical baseline; an aligned row can also retain a pair spanning its cells. Fraction fields, scripts, root bodies and annotation fields are checked separately, so an unrelated closing glyph cannot silently repair another field. It does not evaluate or replace the operand with a rounded number. Missing, mismatched or empty named pairs remain diagnosed with source and visible output.

`uparrow`, `downarrow`, `updownarrow`, `Uparrow`, `Downarrow` and `Updownarrow` retain explicit readable direction and single/double-line identity; corresponding Unicode forms share output. Mathematical indexed limits and annotations retain their original scope. No convergence, implication, gas or precipitate interpretation is inferred from an arrow glyph alone. Explicit chemistry continues to use its independent semantic encoder. These descriptions use the existing editorial symbol policy; they do not claim new native GB point signs.

## Readable literal punctuation

Literal underscores, number signs, ampersands, backslashes, dollar signs and round bullets retain scoped Chinese glyph-name descriptions rather than an unsupported-character placeholder. Generated descriptions keep the complete original UTF-16 source span and do not enter source-word metadata. Escaped literal punctuation in mathematical text retains its full two-character source unit. Ordinary mathematical underscores, alignment ampersands and formula dollar delimiters retain their structural interpretation. Backslashes in mathematical text remain unresolved when they may introduce unsupported TeX commands; plain text can retain a literal backslash description.

These editorial glyph descriptions preserve literal input identity. They do not themselves implement Markdown structure or infer currency from a dollar-sign glyph. Heading/list markers and code scopes have separate bounded adapters described below; links, emphasis and tables remain open. Unsupported characters, unknown commands and unrelated reading/structure diagnostics remain visible.

## Additional readable glyph identities

`hbar`, `triangleq`, `simeq`, `bot` and `complement` retain explicit readable glyph descriptions, corroborated by the primary [KaTeX support table](https://katex.org/docs/support_table.html). The hbar caption includes the actual Latin spelling `h` after the Chinese modification/case name. It does not replace the letter with a numerical physical constant. Triangle equality and the tilde-over-horizontal-line glyph remain distinct from plain equality, similarity and double-tilde approximate equality. The `bot` command retains a shape description rather than being asserted as a native geometric perpendicular sign or evaluated as a logical falsehood.

`ℏ`, `≜`, `≃` and `∁` share the corresponding command outputs. Existing Unicode perpendicular handling remains separate from the explicit `bot` command. Fractions, script/annotation fields, mixed-text alignment and original source spans remain intact. Unknown adjacent expressions remain visibly incomplete, and the existing symbol review policy remains available. These are editorial descriptions, not new native GB signs.

## Array horizontal rules

At a row boundary in a supported array/matrix environment, `hline` is retained as a source-bound row-rule annotation. It has a readable “表格横线” caption in the linear transcription; repeated commands retain repeated rule annotations. The structural identity is corroborated by the LaTeX Project's [CTAN horizontal-rule documentation](https://www.ctan.org/pkg/hhline). Data rows and cells remain separate from rule annotations, including a bottom rule after the final row terminator. Bracketed-array normalization carries the rule metadata into the resulting matrix.

Rules preserve original UTF-16 spans, do not enter editable source-word metadata, and do not add empty data rows or infer changes in matrix dimension. The caption is editorial, not a claimed native GB horizontal-rule sign. A command embedded after cell content, outside a supported alignment, or in a content-free array remains diagnosed and source-visible. Other rule commands, column dividers and arbitrary array column specifications still need their own adapters.

## Array column rules

Array column declarations consisting of `l`, `c`, `r`, whitespace and vertical bars retain the declared column boundaries. The bar syntax is corroborated by the LaTeX Project's [array documentation, table 1](https://tug.ctan.org/macros/latex/required/tools/array.pdf). A readable “表格竖线” annotation is emitted at the corresponding boundary of each valid row. Multiple bars at one boundary retain an explicit exact count, including bars separated by declaration whitespace, rather than multiplying individual captions across every row.

Column-rule annotations preserve their source spans and carry through bracketed-array normalization. They do not create data columns or become absolute-value operators. Data-cell word edits preserve generated borders. When a ruled declaration and actual row lengths disagree, the complete literal declaration is retained once separately and the original data rows continue to encode; the mismatch remains diagnosed. This also bounds expansion for long declarations. Unsupported column modifiers and malformed declarations remain visible and incomplete. These are editorial structure descriptions, not newly asserted native GB vertical-rule signs.

## Markdown code scopes

Document mode recognizes top-level backtick/tilde fences and matching-length backtick code spans. Fence-length/closing-character rules and literal-content scope follow the primary [CommonMark code specification](https://spec.commonmark.org/0.31.2/#fenced-code-blocks). An opening fence can have up to three leading spaces; a closing fence uses the same character with at least the opening length and only trailing spaces/tabs. Backtick fence info cannot contain a backtick. Without a closing fence, code extends to EOF, as permitted by CommonMark.

The braille profile transcribes **verbatim code source**, preserving whitespace and line endings as readable layout rather than applying HTML code-span whitespace folding or fence-body dedentation. Original source, content and delimiter spans remain exact UTF-16 ranges. Readable Chinese start/end captions identify block/span boundaries; fence info stays visible. Code content bypasses formula recognition and escape decoding, and does not execute. Neighboring mathematical scopes retain their ordinary conversion. Captions are protected from source-word edits; real Chinese code words retain their original spans and reading controls.

Explicit math/chemistry/physics modes disable document code-scope recognition, and explicit text mode stays literal. Indented code blocks and fences nested in Markdown list/quote containers are not yet handled as code blocks. This is a bounded code-scope profile, not full CommonMark conformance or a native GB code-transcription certification.

## Markdown heading/list markers

Document mode recognizes ATX heading prefixes of levels 1–6, optional closing hash runs, ordered/unordered list-item prefixes and thematic separators. Opening whitespace/length rules and separator precedence are based on the primary [CommonMark block specification](https://spec.commonmark.org/0.31.2/#atx-headings). Readable captions retain heading level, the exact source numbering (including leading zeros), bullet glyph and up to three leading spaces of source indentation. Source numbering is not automatically replaced by HTML list counters. Code blocks/spans remain literal; unmatched code runs cannot cross paragraph or recognized block boundaries, and heading code spans stay within their heading line.

Real text/formula content continues through its existing encoder with exact source offsets. Generated marker captions stay outside source-word metadata and remain protected during word edits; the selected Chinese tone policy also applies to indentation captions. Literal text/explicit mathematical domains retain their own policies. `recognizeMarkdownMarkers: false` disables marker interpretation in direct conversion and the API, and changing it invalidates cached parser proposals in editor sessions.

This is a source-marker transcription profile, not full Markdown container-tree reconstruction. Deeply indented/nested containers, Setext headings, links/images, emphasis and tables remain open work. It does not assert native GB Markdown formatting signs.

## Modular notation and logical negation

`bmod` retains a readable binary modulo-operation name, while `mod` retains the explicit Latin word `mod` with a neutral readable name. The source forms remain distinct. `pmod` retains a parenthesized modulus annotation with its complete argument; `pod` retains parenthesization without inventing a modulo word. Syntax/alias identities are corroborated by the primary [KaTeX support table](https://katex.org/docs/support_table.html). Negative operands retain unary placement. Missing, empty or unknown modulus fields remain source-visible and diagnosed; no remainder, congruence test or numerical result is computed.

`neg`, `lnot` and `¬` retain the same explicit logical-negation description. They do not become arithmetic subtraction or rewrite propositions through De Morgan's laws. Existing parentheses, indices, fractions and aligned rows retain their original order/scopes. Descriptions stay outside source-word metadata and use the existing editorial symbol policy, not asserted new native GB signs.

## Literal text font families

`texttt` and `textsf` retain explicit readable names for monospaced and sans-serif text families. Their text-font roles are corroborated by the primary [LaTeX font-selection guide](https://www.latex-project.org/help/documentation/fntguide.pdf) and [KaTeX text-font support](https://katex.org/docs/supported.html#style-color-size-and-font). Braced content uses the literal text decoder, preserving Chinese/English words, escaped punctuation and nested inline mathematics. A single unbraced text token retains text framing as well.

Font captions preserve their complete scope, while real source words remain editable at original UTF-16 offsets. Generated captions stay protected during body-word edits. Empty bodies and unknown text controls remain visibly incomplete. The existing font policy can retain manual review instead of descriptions; no new native GB font-family point signs or full TeX typographic composition are asserted.

## Universal quantifier

`forall` and `∀` retain an explicit grouped Chinese description, “全称量词”, rather than an unknown macro or an invented native GB point sign. The source glyph/command identity is corroborated by [KaTeX](https://katex.org/docs/support_table); the quantifier meaning and bound-variable distinction are explained by the primary [Open Logic textbook](https://forallx.openlogicproject.org/a11y/Ch4.html). Variable, domain and predicate tokens keep their existing source order/scopes; no bound variable, predicate, negation or evaluation result is synthesized. Word/math transitions retain their entry marks. Existing existential quantifier signs keep their checked native cells, and automatic document recognition accepts quantifier prefixes.

`symbolPolicy: 'review-unmapped'` keeps the absent native universal-quantifier sign unresolved instead of using the description. Synthetic caption words do not enter editable source-word metadata, and manual edits preserve caption frames. Unknown predicates and ambiguous predicate separators remain incomplete. The corpus report separately counts symbol descriptions and complete outputs using them; those counts are editorial readable transcriptions, not native-symbol certification.

## Absolute-value and norm delimiters

Single `vert/lvert/rvert` and heavy `Vert/lVert/rVert` bars retain distinct §6.2.1 items 11–12 cells (`456` versus `456,2`, printed p9). Control-symbol `\|` is the heavy bar; raw `|` remains single. Unicode `‖` is heavy, while Unicode `∥` retains the checked geometric parallel-line cells, not the norm cells. [KaTeX's delimiter documentation](https://katex.org/docs/supported.html#delimiters) corroborates these source spellings. This is notation conversion, not norm evaluation or a claimed norm choice.

Explicit pairs and matched symmetric pairs are tracked by width and original scope. Generic bar glyphs retain their notation identity without being forced into a norm interpretation; they can also appear as separators or evaluation bars. Opening bars suppress an erroneous binary-sign blank before a unary minus. Closing bars supply the following factorial operand even when scripted. Opening/closing frames stay attached to the first/last body units during wrapping, including matrix row controls. Empty explicit pairs and missing/mismatched explicit endpoints remain visibly incomplete. Automatic document detection accepts matched command pairs and heavy Unicode pairs, without promoting Markdown table pipes to norm syntax. This adapter does not infer the meaning of a generic conditional/evaluation bar from its glyph alone.

## Additional inequality and position-mark commands

`ngtr`, `nless`, `gtrless`, `lessgtr`, `gg` and `ll` and their Unicode glyphs retain the independently checked §6.2.1 items 3–4,7–10 cell patterns and §6.2.2.1 both-side spacing. `gt`/`lt` alias the ordinary comparison glyphs; explicit `not` accepts those two checked negative glyphs without inventing a generic negation overlay for other relations. Command/glyph identity is corroborated by the [KaTeX support table](https://katex.org/docs/support_table.html).

`check`, `breve`, `overparen` and `underparen` retain the §6.5.1 items 16–18 downward-tip/upward-arc/downward-arc glyphs with their actual above/below direction and explicit ending. Compound bodies use whole-expression grouping; opposite arc directions remain distinct. Every ordinary position accent now diagnoses an empty body and displays an unresolved marker inside its scope, rather than reporting a bodyless mark as complete. This correction may appropriately reduce prior false-positive completeness counts for malformed input.

## Bracket position annotations

`underbrace`, `overbrace`, `underbracket` and `overbracket` preserve their whole argument between the bracket signs, preceded by the below/above position indicator. The cell order is independently transcribed from GB/T18028-2010 §6.5.2.6 examples 1–2 (printed p15): lower square `56,12356 … 23456`; upper curly `45,246 … 135`. A label in the same direction uses `46,16` or `46,34`, its own content, and ending `156`; an opposite-direction script remains an ordinary index. TeX brace-label semantics are corroborated by [KaTeX annotation examples](https://katex.org/docs/supported.html#annotation). No implied label/count is invented when none is supplied.

Nested braces keep distinct body and label scopes. Numeric centered labels use the established lower-position digit cells. Literal Chinese labels retain exact original word offsets and manual edits; unresolved content stays visible inside the body or label. Empty arguments/labels remain diagnosed. Long bodies and labels wrap through semantic units with protected leading and ending cells. Genuinely planar matrix placement inside a bracket annotation still requires its structural profile.

## Enclosed expressions

`textcircled` retains its text argument, including numeric text, literal Chinese words and nested inline mathematics. Text-mode semantics are corroborated by [KaTeX options](https://katex.org/docs/options.html). `boxed` retains its mathematical argument and the enclosing square rather than omitting the square as decoration. The trailing enclosure cells are independently transcribed from GB/T18028-2010 §6.5.1 items 23–24 (`6,356` and `6,2356`) and §6.5.2.5 (printed pp14–15). Compound scopes use grouping brackets; the enclosing mark follows the complete expression, including its indices/position marks. Leading/ending framing stays connected to the enclosed content during wrapping. Empty or unresolved content remains visibly incomplete inside the enclosure. Chinese word spans and manual edits preserve neighboring structural cells.
# Logical and negated relation descriptions

`models` / `vDash`, `Vdash`, `Vvdash`, `nvdash`, `nvDash`, `nVdash`, `nVDash`, `nleq`, `ngeq`, `nmid` and `nparallel` retain readable sign descriptions. Captions distinguish line counts and cancellation marks rather than inferring a context-specific proof or divisibility meaning. Unicode counterparts use the same descriptions. The source stays intact; descriptions are editorial transcriptions, not new native GB signs. `review-unmapped` still flags these signs for review.

Command/glyph identities are checked against the [KaTeX symbol definitions](https://raw.githubusercontent.com/KaTeX/KaTeX/main/src/symbols.ts). Fixtures cover fractions, scripts, Chinese aligned text, default 30-cell reflow, Unicode aliases, strict review and manual word edits.

# TeX prose tables

`tabular` cells use the source-bound prose parser, retaining ordinary words, escaped separators and explicitly dollar-delimited mathematics. Readable captions identify table start/end, row and column positions, empty cells, `l`/`c`/`r` alignment, vertical border counts, full horizontal rules and inclusive `cline` column ranges. This is a prose-table linearization rather than a native mathematical matrix. A trailing row terminator does not introduce a fictitious data row. Generated position captions are protected from Chinese word edits.

Column specifications outside the bounded standard grammar, invalid rule ranges, inconsistent logical row widths, unresolved cell controls and malformed inline mathematics retain visible source and remain reviewable. Recognition does not claim full TeX table-package support. Identities and row-rule placement follow the [LaTeX2e sources, lttab.dtx](https://latex-project.org/help/documentation/source2e.pdf). The text parser refactor is shared with existing `text`/`mbox` behavior and retains original source offsets without synthetic wrappers.

`multicolumn` and integer-span `multirow` are parsed as complete cell wrappers with editable text/formula bodies. Cross-axis nesting retains both dimensions. Readable captions distinguish the anchor row/column, signed row count, inclusive covered ranges, horizontal alignment and border overrides, width, vertical positioning, strut settings and movement. Empty cells covered by a multirow refer back to its anchor rather than becoming unrelated blank data. Logical columns advance by the declared span. Bounds, occupied overlap and repeated same-axis wrappers remain reviewable with all bodies retained. Geometry checks have a work budget and never allocate a grid proportional to a declared span.

Multirow syntax and signed direction follow its [maintainer's source documentation](https://raw.githubusercontent.com/pietvo/multirow/master/multirow.dtx). Fractional spans, inherited widths without a paragraph column or compatible multicolumn override, and unevaluated layout expressions remain explicitly unresolved. No TeX commands execute. Optional values remain source-bound, and generated captions stay protected from word edits.

`p{width}`, `m{width}` and `b{width}` retain paragraph-mode cells and their top/center/bottom vertical alignment, including dollar-delimited formulas inside text. Width expressions stay visible as source-bound captions; they do not set a physical Braille line width. Nested `*{count}{pattern}` declarations retain exact logical columns and borders up to 512 expanded columns and a bounded nesting depth. Undefined or excessive patterns stay reviewable with their original specification. Zero repetitions contribute no column. Bracket normalization preserves paragraph metadata, and one-cell paragraph arrays retain their description instead of collapsing to an unlabeled expression.

Paragraph and repeat definitions follow the [LaTeX team's array documentation](https://raw.githubusercontent.com/latex3/latex2e/develop/required/tools/array.dtx). Inherited multirow width resolves from the actual paragraph column or its explicit multicolumn override. Arbitrary `@`, `!`, `>` and `<` declarations remain literal and unresolved; no macro expansion or execution occurs.

# Nested prose controls

Inside prose fields, nested `text`, `mbox`, `textbf`, `textit`, `textrm`, `texttt`, `textsf` and `textcircled` retain their original scopes, literal bodies and explicitly delimited inner mathematics. The same source-bound parser handles prose table and paragraph-array cells. Font families keep their existing readable descriptions and strict-review policy; this does not invent native styled-Chinese points. Empty, unclosed, over-depth or unknown controls remain visibly reviewable.

Text-mode `textbackslash`, `textasciitilde`, `textasciicircum`, `textless` and `textgreater` retain their literal glyph and complete command span. Control-word delimiter whitespace is consumed under TeX semantics, without rewriting source. These controls do not reinterpret their glyphs as math operators or active macros. Longer command-name prefixes stay unknown. Identities follow the [KaTeX text symbol definitions](https://raw.githubusercontent.com/KaTeX/KaTeX/main/src/symbols.ts). Generated font captions remain protected when a source Chinese word is edited.

# Scripts on an empty nucleus

Explicit math with a leading script or an explicitly empty `{}` base retains separate readable empty-base subscript/superscript labels and fully parsed payloads. Successive opposite-direction scripts share that empty nucleus. The adapter does not infer attachment to a following symbol or claim a native GB left-script point sign. Source spans, nested math and Chinese payload edits stay intact; `review-unmapped` marks the editorial description for review. Missing/empty arguments, duplicate directions and unknown payloads remain visible and unresolved.

Empty bases are part of the [KaTeX parser's supsub semantics](https://raw.githubusercontent.com/KaTeX/KaTeX/main/src/Parser.ts); no source rewriting is required. Bare document syntax is still subject to the document scanner's ambiguity rules. Ordinary scripts on actual bases keep their native rules.

# TeX prose whitespace

Original TeX prose fields retain source-bound ASCII spaces, tabs and soft CR/LF line endings as one logical space. Paragraph columns and explicit-width multirow bodies retain blank-line paragraph boundaries through readable captions. Paragraph mode follows logical columns after merged cells and passes through nested text-font commands; restricted `text`/`mbox`/circle bodies keep blank paragraphs reviewable. Text outside TeX prose retains its existing document line-break behavior. No input rewrite changes source offsets or editable Chinese words.

The ordinary TeX whitespace distinction follows the [KaTeX lexer](https://raw.githubusercontent.com/KaTeX/KaTeX/main/src/Lexer.ts); paragraph-column behavior follows the [LaTeX array source](https://raw.githubusercontent.com/latex3/latex2e/develop/required/tools/array.dtx). This does not execute arbitrary TeX commands or claim native Braille paragraph-column width signs.


## 非分解拉丁字母与无点控制词

Unicode 18.0 的 U+00C0–024F 中，33 个不具有分解映射、名称包含 WITH STROKE / WITH BAR 或 DOTLESS I / J 的大写或小写拉丁字母，采用“拉丁＋大小写＋字母＋官方英文名称”的只读盲文说明。源字符、大小写与字形区别均保留；不声称是对应语言的原生盲文，也不将 ħ 当作 ℏ、Ø 当作空集符号。`\imath` / `\jmath` 与无点 i / j 字符使用相同数学说明，命令的完整原文位置保留。未列入的字符、额外组合附标和未知命令继续保留原文并标记待确认，不导致整条结果为空。

名称来源：[Unicode 18.0 UnicodeData](https://www.unicode.org/Public/18.0.0/ucd/UnicodeData.txt)，许可沿用 THIRD-PARTY-NOTICES 中的 Unicode License V3。

## Unicode 排版空白

Unicode 18.0 的 Zs 类别中，除已有普通空格与全角空格外的 15 种空白，在文本及 TeX 文字参数中采用“空白＋官方英文名称”的只读盲文说明。名称保留 EM SPACE、THIN SPACE、NO-BREAK SPACE 等宽度或不可断行身份，不把印刷物理宽度直接换算为盲文格数。原文字符和位置不变，周围文字仍可编辑。普通数学源码中的空白仍按原有数学解析规则处理。零宽空格、WORD JOINER 与 BOM 不被猜测为这些空白；未知字符继续保留可见原文说明与待确认状态。

来源：[Unicode 18.0 UnicodeData](https://www.unicode.org/Public/18.0.0/ucd/UnicodeData.txt)，沿用 Unicode License V3。

## 阿拉伯字母、附标与修饰字符

Unicode 18.0 U+0600–06FF 中的 150 个字母、52 个非间隔附标及 3 个修饰字符，在文本和数学文字字段中采用“阿拉伯＋类别＋官方英文名称”的只读盲文说明。原文顺序和位置不变，不进行阿拉伯文字形连接、双向重排、组合字符归一化或发音推断。附标与修饰字符各自保留完整名称；不将 ARABIC SMALL WAW / YEH 误称为延长符。`أ` 与 `أ` 等不同源码仍保留各自身份，不折叠。说明不声称是原生阿拉伯盲文。

范围外的扩展字母、呈现形式、数字、标点及控制字符继续保留可见原文身份并标为待确认；它们不导致整个公式结果为空。中文分词编辑不替换生成的名称说明。

名称来源：[Unicode 18.0 UnicodeData](https://www.unicode.org/Public/18.0.0/ucd/UnicodeData.txt)，Unicode License V3 见 THIRD-PARTY-NOTICES。

## 隐藏占位命令

`\phantom` / `\hphantom` / `\vphantom` 的一个参数分别保留全部印刷尺寸、只保留水平尺寸、只保留垂直尺寸，内容在印刷中不可见。盲文采用“不可见尺寸／水平／垂直占位”的明确说明，随后以有界字段保留解析后的参数；不把参数静默暴露为普通可见正文，也不直接删除。空参数保留“空内容”说明。印刷尺寸不换算成盲文格数。

在 TeX 文字参数中嵌套时，参数按原文文字处理，保留词间空格；其中显式 `$...$` 数学仍按数学处理。中文分词修改不替换占位说明。未知内容、缺少参数、未闭合参数、只含排版指令的尺寸内容及严格符号审核策略保持可见待确认结果。

行为依据是项目安装的 KaTeX `src/functions/phantom.js` 中 `phantom` / `hphantom` / `vphantom` 的参数和尺寸处理。适配不执行 TeX 宏。

## 已有符号的 Unicode 与命令别名

直接输入 `∴`、`∵`、`□` 分别映射到已有 `therefore`、`because`、`square` 的国标点位与间隔规则。文字模式沿用已有数学符号切换规则；不另造符号点位。标准别名 `\Box` 使用 `square`，`\gets` 使用已有 `leftarrow` 的可读左箭头说明，保留原始命令位置。方块不等同实心方块，左右箭头不互换。

别名与对应码位通过项目安装的 KaTeX `src/symbols.js` 核对。未知扩展命令仍保留可见原文，不按前缀误认成已支持命令。

## 天城文字符与元音附标

Unicode 18.0 U+0900–097F 中 115 个字母、元音附标、其他附标、修饰字符及符号，以“天城文＋类别＋官方英文名称”的只读盲文说明保留身份。不同元音、附标和字符不合并；组合次序沿用源码，不根据印刷字形位置重排，不进行发音、连字塑形或 Unicode 归一化推断。OM、AVAGRAHA 以符号类别保留名称，不误称为字母。说明不声称是原生印地语或其他语言的盲文。

中文混排、数学字段、字体范围和分词手工修改继续保留原文位置。基本区域以外的扩展字符、数字、标点和未知命令仍保留可见原文身份及待确认状态。

来源：[Unicode 18.0 UnicodeData](https://www.unicode.org/Public/18.0.0/ucd/UnicodeData.txt)，Unicode License V3 见 THIRD-PARTY-NOTICES。
