# Bounded source compatibility

Math mode and bare formulas in mixed documents accept Unicode presentation
digits `⁰¹²³⁴⁵⁶⁷⁸⁹` and `₀₁₂₃₄₅₆₇₈₉`, plus superscript `⁺⁻`, as script
syntax. For example, `a²+b²=c²` has the same mathematical braille as
`a^2+b^2=c^2`, `10⁻³` matches `10^{-3}`, and `x₁²` matches `x_1^2`. Original UTF-16 source spans
remain attached to the converted cells. This is an input-compatibility rule,
not a new claim of standard coverage. A sign without following superscript
digits, or superscript letters, remains diagnosed instead of guessed.

Explicit chemistry (`\ce{...}` or chemistry mode) accepts four top-level
source aliases: `v` and `(v)` mean precipitation; `^` and `(^)` mean gas.
Each entire token must be preceded by whitespace or the chemistry content
start and followed by whitespace or the content end. Parentheses are part
of the alias, with no interior whitespace. Nested molecular groups are not
alias contexts. Thus `H2 ^` is accepted, while `H2^`, `H2(v)`, `( v )`, and
`((v))` do not acquire Evolution roles. Existing Unicode arrows remain valid.

Examples: `\ce{SO4^2- + Ba^2+ -> BaSO4 v}` and
`\ce{Fe^{3+} + 3OH^- -> Fe(OH)3 (v)}`. Charges (`Fe^{3+}`, `O_2^-`),
left isotopes (`^{14}C`), and element `V` keep their existing meanings.
Unit charges before spaced aliases also retain charge semantics; ambiguous
compact `Fe3+` remains diagnosed. Arbitrary mhchem commands remain unsupported.
This is a bounded subset of the mhchem manual's “Precipitate and Gas” source
notation (https://mhchem.github.io/MathJax-mhchem/), not full mhchem support.
Raw source and UTF-16 spans are retained; aliases reuse existing Evolution
encoding (`56,34` gas; `45,16` precipitation), with no coverage promotion.

Chinese automatic word proposals recognize exactly four parallel repetition
examples: 来来往往, 说说笑笑, 清清楚楚, 弯弯曲曲. Matches are extracted within
Han runs before ICU segmentation of the remaining gaps; no generic AABB
merge is applied. 爸爸妈妈 remains separate ordinary words and 研究研究 remains
two repeated disyllabic words. Manual spans partition proposal input first,
so partial and complete manual overrides, readings and retain-tone flags
remain authoritative. No new pinyin correction is implied. The existing
limited-grammar proposal and polyphony diagnostics remain applicable.

Boundary evidence: GF0019-2018 §12.2.4, printed p11 / PDF page15, official
Ministry of Education PDF
https://www.moe.gov.cn/jyb_sjzl/ziliao/A19/201807/W020180725666187054299.pdf.
Coordinator and independent auditor visually checked `gf-page-15.png`
(SHA-256 `3ace699578c5d6394ab4da5b2cdc704a80e881227d421461add662e7d8088599`);
PDF SHA-256 `b96dde3c843e50e79c4a372e600baf1ee6f6a52bdfadb51c4e94d751b2e34739`.
These are boundary regressions, not new normative dot fixtures. The registry
entry remains implemented-unverified; neither the entire clause nor all
standards are certified by these code tests.

An editorial geometry vocabulary contains only 边长, 周长, 半径 and 直径.
It joins adjacent **complete ICU word segments** when their concatenation is
exactly one of these nouns. It does not search raw text with longest matching
or split larger ICU words. Thus the current ICU `边|长` becomes the editable
proposal `边长` (dictionary reading `bian1 chang2`), while `这边|长大` and
`一边|长|跑|一边|聊天` retain their boundaries. A known limitation is
`边长相等`: current ICU proposes `边|长相|等`, which this bounded layer leaves
unchanged; correcting that requires contextual analysis or manual boundaries.
ICU proposals can vary between runtime versions. This vocabulary is an
editorial aid, not a normative lexicon, a general Chinese segmenter, or proof
of full GF0019-2018 compliance. Automatic results still require review.
Manual spans/readings/tone flags have precedence, UTF-16 source spans are
preserved, and merges cannot cross punctuation, non-Han runs or formula nodes.
