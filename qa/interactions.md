# QA Checklist: Interaction Requirements

Verify all interactions specified in `docs/design/09-interaction-requirements.md` across each renderer.

## Click: Selection Toggle

### DAG Panel

* [x] Click domain → selects, propagates down
* [x] Click selected domain → deselects, recomputes
* [x] Click deselected category → selects parent domain(s)
* [x] Click deselected entity → selects ancestor domain(s)

### Venn Panel (Enhanced)

* [x] Click domain circle → selects, propagates down
* [x] Click selected domain circle → deselects
* [x] Click intersection → toggles first unselected domain
* [x] Click category circle → toggles parent domain
* [x] Click entity dot → toggles grandparent domain

### Cross-Panel Sync

* [x] DAG click updates Venn panel
* [x] Venn click updates DAG panel
* [x] Entity overlay updates from both panels

## Hover: Cross-Panel Highlight Ring (Step 8)

### DAG Panel

* [ ] Hover domain node → ring on DAG + highlight in Venn
* [ ] Hover category node → ring on DAG + highlight in Venn
* [ ] Hover entity node → ring on DAG + highlight in Venn
* [ ] Mouse-leave → ring removed on both panels

### Venn Panel

* [ ] Hover domain circle → highlight in DAG
* [ ] Hover category circle → highlight in DAG
* [ ] Hover entity dot → highlight in DAG
* [ ] Mouse-leave → highlight removed on both panels

## Resize

* [x] Window resize re-renders DAG panel
* [x] Window resize re-renders Venn panel
* [ ] Categories and entities reposition correctly on resize
