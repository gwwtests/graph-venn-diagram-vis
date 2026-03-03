# QA Checklist: Enhanced Venn Diagram

Tracks visual correctness for the enhanced Venn diagram (domains + categories + entities).

## Test Cases

### Domain Circles (venn.js base)

- [ ] Three domain circles render (Engineering, Science, Arts)
- [ ] Engineering-Science intersection visible (shared entities via Data category)
- [ ] Engineering-Arts intersection visible (x6 via Hardware+Design)
- [ ] Domain labels display correctly

### Category Circles (D3 overlay)

- [ ] Software (c1) renders inside Engineering circle
- [ ] Data (c2) renders in Engineering-Science intersection region
- [ ] Hardware (c3) renders inside Engineering circle
- [ ] Design (c4) renders inside Arts circle
- [ ] Research (c5) renders inside Science circle
- [ ] Category labels visible above their circles
- [ ] Categories have dashed stroke borders

### Entity Dots (D3 overlay)

- [ ] Entity1 (x1) inside Software circle
- [ ] Entity2 (x2) between Software and Hardware (Engineering region)
- [ ] Entity3 (x3) between Software and Data
- [ ] Entity4 (x4) between Data and Research
- [ ] Entity5 (x5) inside Design circle
- [ ] Entity6 (x6) between Hardware and Design (Eng-Arts intersection)
- [ ] Entity labels visible below dots

### Selection & Highlighting

- [ ] Click Engineering → domain circle highlights, categories (Software, Data, Hardware) highlight, entities (x1-x4, x6) highlight
- [ ] Click Science → Data and Research highlight, entities (x3, x4) highlight
- [ ] Click Arts → Design highlights, entities (x5, x6) highlight
- [ ] Deselect works correctly (click again)
- [ ] Multi-domain selection: Engineering+Science → path counts show on shared entities
- [ ] Entity overlay shows selected domains, active categories, and entities with path counts

### Interactions

- [ ] Click on category circle toggles parent domain
- [ ] Click on entity dot toggles grandparent domain
- [ ] Click on intersection toggles first unselected domain
- [ ] Hover on domain circle increases opacity

### Responsiveness

- [ ] Window resize re-renders correctly
- [ ] Categories and entities reposition on resize
- [ ] Layout looks reasonable at different aspect ratios

## Screenshots

Screenshots stored in `assets/screenshots/venn-enhanced-*.png`.
