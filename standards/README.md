# Standards evidence baseline

`registry.json` records implementation and evidence at the rule level; it is not a compliance certificate. The original 31 scopes came from the three official contents pages and later work added narrow rules. Individual clauses still require expansion; `inventoryComplete` remains false. See the [supported profile and detailed registry](../docs/standard-coverage.md). Chapter titles alone are not proof that an encoder implements a rule.

Run `npm test`, `npm run typecheck`, and `npm run verify:coverage`. The gate checks every verified rule, including rules not yet advertised, and requires linked, visually reviewed, official positive and negative fixtures. Legacy fixtures cannot satisfy that gate. Domain tests must execute their encoder against the independent fixtures; the gate validates provenance, not encoder correctness.

Sources and byte hashes are in `provenance.json`. Official scans/viewer images stay in the external local audit directory, outside Git. The GB sources are tiled official viewer page images, not PDF downloads. PDF page 5 of GF is printed page 1; GB viewer image 007 is printed page 1. Captured viewer contents images are hashed as evidence of inventory only.

GF scope: Chinese common-language braille spelling, tone marking, abbreviation, contraction, punctuation and word spacing. Visually reviewed GF printed pages 1–4 establish table locations. Later domain work added executable fixtures; only the five specifically registered omission clauses currently satisfy the positive/negative evidence gate.

GB/T18028 scope: mathematical, physical and chemical symbols, including normative physics Appendix A. Physical embossing geometry in chapter 4 requires an explicit exclusion at the individual physical requirement level for a software-only profile; do not exclude the entire chapter because its digital structure rules also matter. Informational Appendix B is relevant to export interoperability.

GB/T44725 scope: books, periodicals and internal publications, including cover, copyright page, auxiliary text, main text, illustrations and tables. Printed pages 1–2 were visually read. Cover chapter 4.1 is not a general body-text layout rule (its usual 25 rows × 30 cells must not be advertised as the universal line/page size).

Historical repository fixtures (legacy-math.json) and captured snapshot probe observations (*-probe-results.json) are distinct sources. The standalone test checks frozen fixture content (LF-normalized), source hash metadata, unique IDs and the shape of all 27 expectations. It does **not** re-extract historical source or rerun any legacy converter. Old source, Python implementations and isolated audit harnesses are not distributed. The captured 27/27 comparison is historical evidence only; no Django imports, services or production requests are made.

provenance.json retains original source and evidence SHA-256 values with sanitized artifact identifiers. These names are not local paths. Official scan/viewer bytes are not included; reproducing their visual review requires obtaining the identified official edition externally. Passing local fixture tests does not independently validate those absent bytes. Third-party software notices are in [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md).

The independently maintained `inventory-manifest.json` preserves the minimum inventory; do not regenerate it from a filtered registry. Full support requires every manifest entry, every applicable entry verified, and a human-reviewed complete manifest. Expanding a chapter preserves its established ID and adds granular rules. The current manifest is explicitly incomplete and has no approval.

A `not-applicable` rule requires a matching clause-level manifest exclusion with the same structured `reason`, output `profile`, `reviewedBy`, `reviewedAt`, and source `evidence` (HTTPS URL, exact locator, SHA-256). Chapter-wide or free-text-only exclusions are rejected. The manifest and its review are auditable human decisions; passing the gate is not automatic certification.
