# Interactive input and long documents

The web editor, shared editor session and local `/convert`, `/resolve` and `/segment` endpoints accept up to **5000 Unicode code points** per request. This is an operational limit for interactive use, not a braille-standard limit or a restriction on the standalone pure conversion library.

An oversized paste remains intact in the text box. The editor clears stale output, cancels pending work and asks the user to split the text. It does not truncate the source with an HTML `maxlength`. The API rejects an oversized supported request with HTTP 413 before conversion or model work; its response identifies `source-too-long` and `maxCharacters: 5000`. Existing transport body limits still apply.

Consumers can paginate their own previews without truncating source or exports. The source repository tests cover stale replies after an oversized paste, Unicode code-point counting and endpoint rejection before provider calls. The standalone library retains its existing parser resource limits and does not inherit the interactive 5000-character limit.
