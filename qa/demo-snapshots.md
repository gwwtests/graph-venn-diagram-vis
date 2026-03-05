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
| dual | [x] | [x] | |

**9/10 work from file://.** Orb is a known limitation (Web Workers require CORS/HTTP).

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
| dual | [x] | [x] | |

**10/10 work via HTTP** (`python3 -m http.server -d demos`).

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
| sigma | [x] | [ ] | [ ] | [x] | [ ] |
| visnetwork | [x] | [ ] | [ ] | [x] | [ ] |

### Venn Visualizations

| Viz | Click Domain | Click Category | Click Entity | Deselect | Legend/Info |
|-----|-------------|---------------|-------------|----------|------------|
| venn | [x] | N/A | N/A | [x] | [x] |
| venn-enhanced | [x] | [x] | [x] | [x] | [x] |
| dual | [x] | [x] | [x] | [x] | [x] |

## Landing Pages

* [x] `demos/index.html` — lists all snapshots, links work
* [x] `demos/bidirectional-selection/index.html` — lists all 10 vizs, links work
* [x] Orb card shows "(HTTP server required)" note
* [x] Back link ("All Snapshots") works

## Snapshot Script (`demos/snapshot.sh`)

* [x] Builds all 10 visualizations
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

* **Orb requires HTTP server** — Web Workers + import.meta enforce CORS, incompatible with file://. Documented in `demos/bidirectional-selection/orb/README.md`.
* **Selection interaction coverage varies** — not all DAG renderers implement category/entity click or legend. See `docs/design/09-interaction-requirements.md` for full spec.
