# Interaction Requirements

Canonical spec for all user interactions across visualization panels. When adding new renderers or views, consult this document and verify compliance via `qa/interactions.md`.

## Click: Selection Toggle

| Target | Current State | Action |
|--------|--------------|--------|
| Domain node | Deselected | Select domain, propagate down |
| Domain node | Selected | Deselect domain, recompute |
| Category node | Selected | Deselect parent domain(s), recompute |
| Category node | Deselected | Select parent domain(s), propagate down |
| Entity node | Selected | Deselect grandparent domain(s), recompute |
| Entity node | Deselected | Select ancestor domain(s), propagate down |

## Hover: Cross-Panel Highlight Ring

**Status**: Planned (Step 8)

* Hovering any node shows a visible highlight ring/halo around it
* Highlight is synchronized across **all** panels (DAG + Venn)
* Ring disappears on mouse-leave
* Ring color matches the node's tier (domain=cyan, category=green, entity=red)
* Should not trigger state changes — purely visual feedback

### Hover behavior per panel

| Panel | Node type | Hover visual |
|-------|-----------|-------------|
| DAG | Any node | Bright ring behind the circle |
| Venn | Domain circle | Thicker stroke or glow on domain circle border |
| Venn | Category circle | Bright ring around dashed category circle |
| Venn | Entity dot | Bright ring around entity dot |

## Resize: Responsive Re-render

* Window resize re-renders both panels
* Category and entity positions recalculate from new domain circle geometry
* Debounced (100ms) to avoid thrashing

## Future Interactions (placeholder)

* **Drag**: rearrange node positions (DAG panel only?)
* **Tooltip**: show node details on sustained hover
* **Multi-select**: shift+click to add to selection without toggling
