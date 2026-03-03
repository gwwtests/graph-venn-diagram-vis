# QA Checklist: Enhanced Venn Diagram

Tracks visual correctness for the enhanced Venn diagram (domains + categories + entities).

## Test Cases

### Domain Circles (venn.js base)

* [x] Three domain circles render (Engineering, Science, Arts)
* [x] Engineering-Science intersection visible (shared entities via Data category)
* [x] Engineering-Arts intersection visible (x6 via Hardware+Design)
* [x] Domain labels display correctly

### Category Circles (D3 overlay)

* [x] Software (c1) renders inside Engineering circle
* [x] Data (c2) renders in Engineering-Science intersection region
* [x] Hardware (c3) renders inside Engineering circle
* [x] Design (c4) renders inside Arts circle
* [x] Research (c5) renders inside Science circle
* [x] Category labels visible above their circles
* [x] Categories have dashed stroke borders

### Entity Dots (D3 overlay)

* [x] Entity1 (x1) inside Software circle
* [x] Entity2 (x2) between Software and Hardware (Engineering region)
* [x] Entity3 (x3) between Software and Data
* [x] Entity4 (x4) between Data and Research
* [x] Entity5 (x5) inside Design circle
* [x] Entity6 (x6) between Hardware and Design (Eng-Arts intersection)
* [x] Entity labels visible below dots

### Selection & Highlighting

* [x] Click Engineering → domain circle highlights, categories (Software, Data, Hardware) highlight, entities (x1-x4, x6) highlight
* [ ] Click Science → Data and Research highlight, entities (x3, x4) highlight
* [ ] Click Arts → Design highlights, entities (x5, x6) highlight
* [ ] Deselect works correctly (click again)
* [x] Multi-domain selection: Engineering+Science+Arts → path counts show on shared entities
* [x] Entity overlay shows selected domains, active categories, and entities with path counts

### Interactions

* [x] Click on category circle toggles parent domain
* [x] Click on entity dot toggles grandparent domain
* [x] Click on intersection toggles first unselected domain
* [x] Hover on domain circle increases opacity

### Responsiveness

* [ ] Window resize re-renders correctly
* [ ] Categories and entities reposition on resize
* [ ] Layout looks reasonable at different aspect ratios

### Dual Panel Integration (Phase 3)

* [x] Enhanced Venn renders in dual panel right side
* [x] DAG click syncs to Venn panel (categories + entities update)
* [x] Venn click syncs to DAG panel
* [x] Entity overlay updates from both panels
* [x] Reset button clears both panels

## Screenshots

* `assets/screenshots/venn-enhanced-initial.png` — Initial state, all 3 tiers visible
* `assets/screenshots/venn-enhanced-eng-selected.png` — Engineering selected
* `assets/screenshots/venn-enhanced-all-selected.png` — All domains selected
* `assets/screenshots/dual-enhanced-initial.png` — Dual panel initial state
* `assets/screenshots/dual-enhanced-eng-selected.png` — Dual panel with Engineering selected
