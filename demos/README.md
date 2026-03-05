# Static Demo Snapshots

Self-contained visualization snapshots that work offline — open directly from disk (`file://`), serve locally, or deploy to GitHub Pages.

## Viewing Demos

**From disk** — double-click any `index.html` file in your file manager, or:

```bash
xdg-open demos/index.html                        # top-level listing
xdg-open demos/bidirectional-selection/index.html # specific snapshot
```

**Local server** (optional, not required):

```bash
python3 -m http.server 8234 -d demos
# or
npx serve demos -l 8234
```

**GitHub Pages** — point Pages to the `demos/` directory.

## Creating a New Snapshot

```bash
./demos/snapshot.sh [name]
```

* If `name` is omitted, uses the current git tag or short commit hash
* Builds all visualizations via Vite, copies into `demos/{name}/`
* Fixes asset paths for `file://` compatibility
* Generates landing pages automatically

### Examples

```bash
./demos/snapshot.sh v1.0              # named snapshot
./demos/snapshot.sh                   # auto-named from git
./demos/snapshot.sh my-experiment     # custom name
```

## Snapshot Naming Conventions

* Git tags: `v1.0`, `v2.0-beta`
* Feature names: `bidirectional-selection`, `force-layout-update`
* Commit hashes: `abc1234` (auto-generated fallback)

## Structure

```
demos/
├── index.html              — Landing page (links to all snapshots)
├── snapshot.sh             — Script to create snapshots
├── README.md               — This file
├── bidirectional-selection/ — A snapshot
│   ├── index.html          — Snapshot landing (links to each viz)
│   ├── dual-v1/
│   │   ├── index.html
│   │   └── assets/
│   ├── venn-enhanced/
│   ├── venn/
│   └── ...                 — 10 visualizations total
└── (future snapshots...)
```

## Visualizations Included

| Name | Description |
|------|-------------|
| cytoscape | Cytoscape.js + dagre |
| d3dag | D3.js + d3-dag (Sugiyama) |
| forcegraph | force-graph (vasturiano) |
| orb | @memgraph/orb + dagre |
| reagraph | reagraph (WebGL/React) |
| sigma | Sigma.js v3 + graphology |
| visnetwork | vis-network (hierarchical) |
| venn | Venn Diagram (upsetjs/venn.js) |
| venn-enhanced | Enhanced Venn (domains + categories + entities) |
| dual-v1 | Dual Panel v1 (DAG + Venn synchronized) |
