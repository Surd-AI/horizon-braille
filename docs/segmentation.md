# Optional online word proposals

The offline core still uses editable local proposals. Explicit online conversion
can request model word boundaries before disambiguation; segmentation does not
call the disambiguation provider. Model boundaries are proposals, never manual
readings or evidence of complete GF0019-2018 grammatical compliance.

`ConvertOptions.wordBoundaries` is an optional ordered array of `{start, end}`
absolute UTF-16 offsets into the original source. Each range must cover a
nonempty sequence of complete Han characters. Ranges cannot overlap, split a
surrogate pair, or cross punctuation/formula syntax. Each Han run touched by
the array must be completely partitioned; untouched runs retain local proposals.
Malformed arrays are ignored with `CHINESE_INVALID_WORD_BOUNDARIES`. The core
does not fetch a model or bind a server. Its transport-neutral offsets must be
bound to the original source by the caller.

Accepted external partitions replace the ICU proposal, then pass through the
same existing bounded repetition/suffix rules and editorial geometry vocabulary.
For example model-proposed `研究研究` still splits into `研究|研究`, while
`妈|妈` and `我|们` join. The four already checked AABB examples remain joined
within manual gaps, even if an external token crosses them; affected gaps use
local proposals. Manual words bypass automatic normalization. This is the
existing limited rule set, not generic AABB or full grammatical analysis;
human review remains necessary and model responses are not certification.

Valid manual `overrides` have priority. An automatic word intersecting any
manual span is dropped, and uncovered gaps use local proposals; manual spans,
readings and retain-tone flags are never split or replaced. Explicit Chinese
text inside supported math/chemistry text nodes can receive proposals at its
original offsets. Formula syntax is not passed to a natural-language tokenizer.

## Local API

Configure `HORIZON_SEGMENT_URL=http://127.0.0.1:8791/segment` only on the Node
service. A private loopback tunnel can use another port. Requests cannot set a
backend URL. The adapter accepts only literal loopback HTTP `/segment` URLs,
without credentials, queries or fragments, and refuses redirects.

`POST /segment` takes `{source, options}` and returns
`{documentSource, wordBoundaries, model}`. It uses the core's parsed Chinese
metadata to extract consecutive Han runs, preserving original UTF-16 positions.
The backend protocol is `POST {texts: string[]}` and response
`{model: string, tokens: string[][]}`. Every token must be a nonempty, well-formed
Unicode string; each row must reconstruct its input exactly. The adapter derives
Han ranges from token contents and validates complete Chinese coverage again.
Limits are 64 runs, 4,096 UTF-16 units per run, 10,000 total, a 128 KiB response,
and a 10-second deadline including response-body reading. Failure produces a
sanitized HTTP 503; no document, upstream body or private configuration is
included in errors. Existing Host, Origin, JSON-body and concurrency restrictions
apply to this endpoint too.

`/resolve` and `/convert` accept the same `wordBoundaries` plus validated
`chinese` options (`tones`, `contractions`, `unknownSemanticTone`). The client
sends these same semantic settings to the Worker and server; layout is separate.

## Editor session

The fourth optional `EditorSession` constructor argument is a
`SegmenterProvider(job, signal)`. `segmentOnline()` resolves to `true` only when
the source-bound, fully covering response is accepted. It does not increment
`semanticRevision`; the UI can then run `resolveOnline()` using the accepted
boundaries. Observe `segmentBusy`, `segmentStatus`, `segmentModel` and
`segmentError` through `onChange`.
`createSession({segmenter})` optionally injects a deployment-specific adapter;
the zero-argument form uses the local Node endpoint. The core and Worker do not
know gateway credentials or authentication protocols. A separate 15-second
session deadline covers both the provider and subsequent Worker encoding, even
when an injected provider ignores cancellation; late results are discarded.

Semantic edits and `cancelOnline()` cancel outstanding requests; late replies
cannot overwrite newer source or manual decisions. Source and parsing-mode
changes clear automatic boundaries. Layout changes keep them. Failures retain
the existing conversion and manual edits; that existing conversion may already
contain an earlier model proposal, so the UI must not label every fallback as
local. A successful model response does not certify its segmentation or readings.

The optional model service is documented separately in
[`apps/segmenter`](../apps/segmenter/README.md). Model weights and deployment
credentials are not part of the core package.
