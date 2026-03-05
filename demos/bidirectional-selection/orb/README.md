# Orb Visualization — HTTP Server Required

This demo uses [@memgraph/orb](https://github.com/memgraph/orb) for graph rendering.

## Why it won't work from `file://`

Orb uses **Web Workers** via `import.meta` for its rendering pipeline. Browsers block
Web Worker creation from `file://` URLs due to CORS / same-origin restrictions.
All other 9 demo visualizations work fine from `file://` — only orb has this limitation.

## How to serve it

From the repository root:

```bash
# Option A — Python
python3 -m http.server 8234 -d demos

# Option B — Node / npx
npx serve demos -l 8234
```

Then open: `http://localhost:8234/bidirectional-selection/orb/index.html`

Or clone the repo and use the helper script:

```bash
./serve-demos.sh
```
