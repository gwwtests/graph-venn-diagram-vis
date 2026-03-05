# Agent Guidelines for graph-venn-diagram-vis

## UI Interaction Requirements Process

When adding or changing any user-facing interaction (click, hover, drag, keyboard, etc.):

1. **Document the requirement** in `docs/design/09-interaction-requirements.md` — this is the canonical spec
2. **Add QA test cases** to `qa/interactions.md` — one checkbox per renderer/panel combination
3. **Verify across all renderers** — each interaction must work consistently in every active visualization (DAG, Venn standalone, Venn enhanced, dual panel)

This ensures that when new renderers or views are added later, there is a clear checklist of interactions they must support. Don't implement an interaction in one view without documenting it for all views.

## Visualization Color Assignments

When adding new domains, assign colors in **all** files that have `DOMAIN_COLORS` / `SELECTED_COLORS` maps:

* `src/vis/venn/main.ts`
* `src/vis/venn-enhanced/main.ts`
* `src/vis/dual-v1/main.ts`
