# Static assets under `public/static/`

## Live (do not delete)

- `three_test.html` — iframe source for `frontend/src/pages/ThreeModel.tsx` (`/three`).
- `js/three_viewer_enhanced.js` — loaded by `three_test.html`.
- Large data trees (drone / InSAR / models / images, etc.) — **kept in-tree** for Aliyun deploy; not moved this cleanup.

## Removed (cleanup round 4, 2026-10)

Standalone legacy page shells and their companion scripts were unused by the React
router (Cover / domain pages / Insar native). Deleted after grep:

- HTML: `cover|cracks|drone|insar|overview|settlement|temperature|tickets|vibration.html`
- JS companions: charts/cover/cracks/drone/overview/settlement_*/temperature/tickets/tunnel/vibration/main/unity-loader/three_viewer.js (non-enhanced), chart-debug/zoom

Insar dead `mode: 'iframe'` state was removed in cleanup round 5 (never rendered
an iframe / static HTML shell).
