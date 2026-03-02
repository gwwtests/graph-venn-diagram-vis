# Adaptive Split Layout Design

## Goal

The two visualization panels (DAG graph + Venn diagram) should share the viewport with an adaptive split that responds to the browser's aspect ratio.

## Rules

| Condition | Split Direction | Panel 1 | Panel 2 |
|-----------|----------------|---------|---------|
| `width > height` | Left / Right | DAG (left) | Venn (right) |
| `height >= width` | Top / Bottom | DAG (top) | Venn (bottom) |

## Implementation Approach

* Use CSS Flexbox or CSS Grid as the layout container
* `flex-direction` toggles between `row` (side-by-side) and `column` (stacked)
* A single media query or JS `ResizeObserver` detects aspect ratio changes
* Each panel occupies 50% of the available space by default
* Optional: a draggable divider allowing the user to adjust the split ratio

## Responsive Behavior

* On window resize, the layout re-evaluates `width > height` and flips if needed
* Transition should be smooth (CSS transition on flex-direction change)
* Both visualization panels must handle their own resize events to redraw/refit their content
* Minimum panel size enforced (e.g., 300px) — below that, consider a tabbed view instead

## CSS Sketch

```css
.dual-panel {
  display: flex;
  width: 100vw;
  height: 100vh;
}

/* Wide viewport: side by side */
@media (min-aspect-ratio: 1/1) {
  .dual-panel { flex-direction: row; }
  .panel { width: 50%; height: 100%; }
}

/* Tall viewport: stacked */
@media (max-aspect-ratio: 1/1) {
  .dual-panel { flex-direction: column; }
  .panel { width: 100%; height: 50%; }
}
```

## Panel Contents

Each `.panel` contains:

* A toolbar/header strip with:
  * Visualization mode selector (dropdown or tabs)
  * Optional controls (zoom, reset, fit-to-view)
* The visualization canvas area (fills remaining space)

## Edge Cases

* Very narrow viewports (< 600px): consider single-panel with tab switching
* Touch devices: divider drag should work with touch events
* Print/export: both panels side-by-side regardless of aspect ratio
