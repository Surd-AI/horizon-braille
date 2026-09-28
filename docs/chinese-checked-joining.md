# Checked Chinese word joining

The bounded lexicon in `packages/core/src/language/checked-lexicon.ts` records 31 complete examples from GF 0019—2018, printed pages 10 and 12 (§12.2.1, §12.2.2, §12.2.5 and §12.2.6). It supplements automatic ICU or HanLP proposals; it is not a claim that either tokenizer implements all braille word-joining rules.

Only complete adjacent automatic words can be joined, to a maximum of four Han characters. For example, proposals `手 / 工 / 业 / 者` become `手工业者`. The proposals `艺术 / 家乡 / 村` stay intact: a dictionary substring must not split `家乡` to invent `艺术家`. Punctuation, formulas and manual word boundaries remain barriers. Source offsets and text are preserved. Repeated disyllabic words remain separate.

The exact example readings provide bounded contextual evidence. They do not authorize trusting arbitrary tokenizer pinyin or resolving an isolated polyphonic character without its word context. Manual corrections take precedence. Unlisted compounds, proper names and context-dependent grammatical groups still require automatic proposals and, where ambiguous, contextual or manual review.

Tests deliberately supply over-segmented automatic proposals, false-positive substrings, manual boundaries, repetitions and punctuation. Existing standard coverage manifests retain their separate verification status; adding these examples does not certify all of §12.
