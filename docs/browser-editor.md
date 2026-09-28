# Standalone browser editor

Run npm ci then npm run dev and open http://127.0.0.1:5173. No original website checkout, login, CDN or API server is required for offline conversion. npm run build:playground produces dist/playground; npm run build:browser produces dist/browser.

The browser library exports core interfaces, mountEditor(host, options) and the shared session API. It includes an inline Worker and scoped CSS. setSource preserves exact source while invalidating stale manual ranges/decisions; dispose releases owned work. Embedding requires CSP permission for Blob Workers. Retain the bundled pinyin-pro MIT notice and generated artifact manifest.

Source/domain/manual changes invalidate old work; layout-only changes reuse cached atoms. Native labelled controls support keyboard interaction, diagnostics and source mappings. Long result lists are paginated but exported data is not truncated. Coverage counts are generated from the shared registry and are not a compliance score.

Online disambiguation is optional and explicitly triggered through the loopback API at 127.0.0.1:8787. Keys stay server-side; no requests occur merely from mounting the editor. See [API configuration](../apps/api/README.md). No production deployment or external website integration is included in this repository.

Run npx playwright install chromium then npm run test:browser to check the real Worker/editor flows. See [validation](verification.md).
