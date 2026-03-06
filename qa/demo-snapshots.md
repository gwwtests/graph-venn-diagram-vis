# QA Checklist: Static Demo Snapshots

Tracks correctness of the `demos/` static snapshot system.
Snapshot under test: `demos/bidirectional-selection/`

## Loading: file:// Protocol (Direct Disk Access)

| Viz | Loads | Graph Renders | Notes |
|-----|-------|---------------|-------|
| cytoscape | [x] | [x] | |
| d3dag | [x] | [x] | |
| forcegraph | [x] | [x] | |
| orb | [ ] | [ ] | Requires HTTP — uses Web Workers + import.meta |
| reagraph | [x] | [x] | |
| sigma | [x] | [x] | |
| visnetwork | [x] | [x] | |
| venn | [x] | [x] | |
| venn-enhanced | [x] | [x] | |
| dual-v1 | [x] | [x] | |
| dual-all | [x] | [x] | Iframes load sibling viz dirs |

**10/11 work from file://.** Orb is a known limitation (Web Workers require CORS/HTTP).

## Loading: HTTP Server

| Viz | Loads | Graph Renders | Notes |
|-----|-------|---------------|-------|
| cytoscape | [x] | [x] | |
| d3dag | [x] | [x] | |
| forcegraph | [x] | [x] | |
| orb | [x] | [x] | Worker path fixed to relative |
| reagraph | [x] | [x] | |
| sigma | [x] | [x] | |
| visnetwork | [x] | [x] | |
| venn | [x] | [x] | |
| venn-enhanced | [x] | [x] | |
| dual-v1 | [x] | [x] | |
| dual-all | [x] | [x] | Both iframes render, dropdowns work |

**11/11 work via HTTP** (`python3 -m http.server -d demos`).

## Layout Hierarchy (DAG Views)

Correct order: **Domains (top) → Categories (middle) → Entities (bottom)**

* [x] cytoscape — correct hierarchy
* [x] d3dag — correct hierarchy
* [x] forcegraph — correct hierarchy
* [x] orb — correct hierarchy (HTTP only)
* [x] reagraph — correct hierarchy
* [x] sigma — correct hierarchy (fixed: was inverted)
* [x] visnetwork — correct hierarchy

## Node Spacing / Text Readability

* [x] cytoscape — labels readable, no overlap
* [x] d3dag — labels readable, no overlap
* [x] forcegraph — labels readable after spacing fix (charge -800, collision radius 50)
* [x] orb — labels readable (HTTP only)
* [x] reagraph — labels readable, no overlap
* [x] sigma — labels readable, good tier spacing
* [x] visnetwork — labels readable, no overlap

## Selection Interaction (Click)

### DAG Visualizations

| Viz | Click Domain | Click Category | Click Entity | Deselect | Legend/Info |
|-----|-------------|---------------|-------------|----------|------------|
| cytoscape | [x] | [x] | [x] | [x] | [x] |
| d3dag | [x] | [ ] | [ ] | [x] | [ ] |
| forcegraph | [x] | [x] | [x] | [x] | [x] Added |
| orb | [ ] | [ ] | [ ] | [ ] | [ ] HTTP only, untested |
| reagraph | [x] | [ ] | [ ] | [x] | [ ] |
| sigma | [x] | [ ] | [ ] | [x] | [x] Added |
| visnetwork | [x] | [ ] | [ ] | [x] | [ ] |

### Venn Visualizations

| Viz | Click Domain | Click Category | Click Entity | Deselect | Legend/Info |
|-----|-------------|---------------|-------------|----------|------------|
| venn | [x] | N/A | N/A | [x] | [x] |
| venn-enhanced | [x] | [x] | [x] | [x] | [x] |
| dual-v1 | [x] | [x] | [x] | [x] | [x] |

### Dual-All (Switchable)

| Feature | Status | Notes |
|---------|--------|-------|
| Default renderers | [x] | Left=visnetwork, Right=venn-enhanced |
| Dropdown switching | [x] | All renderers available |
| postMessage sync | [x] | Click in left → right updates |
| Reset button | [x] | Reloads both iframes |

## Resize Behavior (800x500 viewport)

* [x] cytoscape — re-renders correctly at smaller size
* [x] d3dag — re-renders correctly
* [x] forcegraph — nodes spread wide, some labels near edge at small viewport
* [ ] orb — HTTP only, untested resize
* [x] reagraph — handles resize
* [x] sigma — handles resize
* [x] visnetwork — handles resize
* [x] venn — SVG scales correctly
* [x] venn-enhanced — SVG scales correctly
* [x] dual-v1 — both panels adapt, labels compress but readable
* [x] dual-all — iframes resize with panels

## Thumbnail Previews

* [x] All 11 vizs have 640x400 screenshots in `thumbnails/`
* [x] Optimized with optipng
* [x] Landing page cards show thumbnail images
* [x] Images lazy-loaded

## Landing Pages

* [x] `demos/index.html` — lists all snapshots, links work
* [x] `demos/bidirectional-selection/index.html` — lists all 11 vizs with thumbnail previews
* [x] Orb card shows "(HTTP server required)" note
* [x] Orb shows file:// info overlay when opened from disk
* [x] Back link ("All Snapshots") works

## Snapshot Script (`demos/snapshot.sh`)

* [x] Builds all 11 visualizations
* [x] Copies dist-* into snapshot directory
* [x] Fixes absolute asset paths → relative in HTML
* [x] Removes type="module" and crossorigin, adds defer (for non-import.meta bundles)
* [x] Detects import.meta usage and preserves type="module" (orb)
* [x] Fixes worker paths in JS: "/assets/file" → "./file" for import.meta bundles
* [x] Removes source maps
* [x] Generates snapshot landing page
* [x] Updates top-level demos/index.html
* [x] Refuses to overwrite existing snapshot
* [x] Auto-names from git tag or short hash when no name given

## Known Limitations

* **Orb requires HTTP server** — Web Workers + import.meta enforce CORS, incompatible with file://. Documented in `demos/bidirectional-selection/orb/README.md`. Info overlay shown on file://.
* **Selection interaction coverage varies** — not all DAG renderers implement category/entity click or legend. See `docs/design/09-interaction-requirements.md` for full spec.
* **Forcegraph at small viewports** — force simulation may spread nodes near viewport edges at widths below ~900px.
* **dual-all sync** — postMessage-based; each viz must have postMessage listener (added to all 10+ vizs).
