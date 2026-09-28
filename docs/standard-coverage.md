# Standard coverage and supported profile

This page pairs concrete supported input types with the rule-level evidence registry (updated 2026-09-28). `npm run verify:coverage` reports `valid:true`, `inventoryComplete:false`, `fullStandardSupport:false`, no gate errors. The gate checks recorded evidence and is not a certificate for every converted document.

| Registry | Independently verified | Implemented, evidence pending | Additional rules to develop |
|---|---:|---:|---:|
| GF0019-2018 | 7 | 17 | 9 |
| GB/T18028-2010 | 0 | 39 | 32 |
| GB/T44725-2024 | 0 | 10 | 6 |
| Total | 7 | 66 | 47 |

The 120 registry entries mix broad chapter scopes and narrow rules. They are **not an exhaustive inventory of individual normative requirements**, and 7/120 is not a standards compliance percentage. No entry is currently excluded as not applicable. `advertisedRuleIds` remains empty. Counts in the editor are generated from the shared registry; exported audit JSON includes that registry and coverage metadata.

The seven verified entries are GF0019 Annex C (all 26 English letter dot patterns), §9.4 (special 他/它 spelling), §10.2.1 (first-tone f omission), §10.2.2 (second-tone omission/tou exception), §10.2.3 (fourth-tone initial omission/le and zi exceptions), §10.2.5 (specified vowel-only exceptions), and §10.2.6 (o/e distinction). Each links independently reviewed official positive and negative fixtures. Other functioning encoders remain `implemented-unverified` until the same rule-specific evidence and applicability requirements are met.

There are 40 Chinese/Annex C, 34 math, 8 physics, 33 chemistry, and 15 layout fixture records in the domain JSON files. These 130 records differ in granularity, derived/official provenance and evidence completeness. They execute in the suite but must not be called 130 verified standard rules. The original `official.json` baseline is empty; actual fixtures live in the named domain files. The 27 legacy expectations remain comparison evidence only; independent corrections deliberately differ from historical output. The 64 BRF carrier entries are independently transcribed tests as well as property-tested roundtrips.

## Working scope and remaining gaps

| Area | Working scope | Limits that remain visible |
|---|---|---|
| Mixed document | Chinese, bare fraction/root/scripts, Unicode Greek symbols, infix operators and scripts, typed math/chemistry islands, `$...$`, `$$...$$`, `\(...\)`, `\[...\]`, CRLF and blank-paragraph recovery, exact UTF-16 spans | Bounded recognition, not arbitrary TeX; weak ambiguous syntax and unknown macros remain diagnosed; literal dollars need `\$`; paths retain source but may have unsupported characters |
| Chinese | Checked initial/final/tone tables, bounded omission/contraction rules, manual readings and word boundaries, 31 exact standard-example words joined only across complete automatic proposals, circled numerals ①–⑩, all 26 English letter dot patterns from informative Annex C, shared formula/chemical-condition analysis | Dictionary segmentation/readings are proposals; full grammatical §12 segmentation and contextual §10.2.8 interpretation are not automated or certified; other circled numerals remain unsupported; the letter table alone does not certify foreign-word spelling |
| Math/physics | Existing checked operators, fractions, roots, scripts, supported fonts/accents, functions, linear cases, aligned/gathered rows and matrix rows, explicit physics/unit mode; bounded single-letter `f:A→B` mapping syntax and selected §6.18 set relations | Not full TeX font semantics; nested/combined spatial matrices, arbitrary structural line breaks, general type annotations and unsupported symbols remain incomplete; physics variable/unit classification remains bounded |
| Chemistry | Explicit `\ce`, element case, counts, charge, isotope, reaction/bond distinction, supported states and conditions; explicit oxidation annotations, bounded linear single-variable counts and complete linear electron configurations including [Ne]/[Ar] shorthand, checked pure-element atom counts and isotope/order cases, explicit linear secondary decomposition annotations; a separate typed graph API handles a short horizontal structure path | No valence/balance verification; compact ambiguous `Fe3+` requires clarification; arbitrary symbolic indices, planar decomposition, general spatial graphs, Lewis/orbital layouts and arbitrary mhchem are unsupported; malformed brackets/charges do not silently become math |
| Publishing | Shared atomic wrapping, Chinese next-line 36, mathematical line-end 6, paragraph/page controls, Unicode/BRF, source mappings, supplied page labels | Covers, contents, publication apparatus, facing/complex tables and arbitrary planar layouts are not implemented; too-wide atomic groups return incomplete with empty exports |
| Disambiguation | Manual priority, local colon/polyphonic candidates, bounded server-only provider with explicit UTF-16 target identity and reasoning off, comma-local grammar, stale result rejection and fallback; whole numeric colon chains, signed decimal ratios, explicit clock/duration units and bounded plain-text numeric slash fractions | General slash/minus/element prose ambiguity extractors and general mapping expressions remain future work; default confirmed-clock expansion is a semantic normalization policy, not a verified special clock-colon cell rule; ambiguous duration units require context or a manual choice |

## Font and layout policy

The named `roman-light-normalized` profile treats unstyled mathematical letters as Roman light and retains supported explicit styles. It emits one informational diagnostic per mathematical conversion. This is an editorial normalization, **not a GB-defined TeX default or source-font fidelity**. Ordinary `p` and `\mathrm{p}` may lose their original visual distinction; presence/absence of 1246 alone does not establish a semantic distinction. Font does not imply variable, constant or unit meaning. Exact TeX defaults depend on character/function class; this implementation does not claim otherwise.

Default custom layout is 30 cells × 25 body rows with 2-cell paragraph indent. That numeric indent is an editorial default, not a requirement inferred from a general paragraph clause. The `book-body` profile fixes 30 × 25 and accepts caller-supplied six-dot page labels, with its documented footer/duplex placement. It does not invent a certified page-number font. Conservative structural atomic groups may overflow at narrow widths even when a more sophisticated, currently unimplemented legal break might exist. Neither `strict:false` nor API success upgrades compliance or allows silently dropped cells.

Provenance, evidence hashes and the minimum manifest are in `standards/`; scan images remain outside Git. Full support requires independently reviewed exhaustive applicability inventory and every applicable rule/fixture, not just additional passing examples.
