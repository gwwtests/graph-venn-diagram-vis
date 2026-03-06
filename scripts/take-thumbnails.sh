#!/usr/bin/env bash
# Take colorful thumbnails for all demo visualizations.
# Requires Chromium running with CDP on the specified port.
#
# Usage: ./scripts/take-thumbnails.sh [--port 9337]
set -euo pipefail

PORT="${1:-9337}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CDP_SCRIPT="$SCRIPT_DIR/cdp-click-and-screenshot.py"

SNAP_DIR="$PROJECT_DIR/demos/bidirectional-selection"
THUMB_DIR="$SNAP_DIR/thumbnails"
mkdir -p "$THUMB_DIR"

# Prefer HTTP server for all vizs (orb requires it)
BASE_URL=""
if curl -s "http://localhost:8234/" > /dev/null 2>&1; then
    BASE_URL="http://localhost:8234/bidirectional-selection"
    echo "Using HTTP server at localhost:8234"
else
    BASE_URL="file://$SNAP_DIR"
    echo "Using file:// protocol (orb will be skipped)"
fi

W=640
H=400

# Node IDs in the graph:
# Domains: d1=Engineering, d2=Science, d3=Arts, d4=Production, d5=Computing
# Categories: c1=Software, c2=Data, c3=Hardware, c4=Design, c5=Research
# Entities: x1=Entity1 ... x6=Entity6

take_thumb() {
    local viz="$1"
    shift
    local url="$BASE_URL/$viz/index.html"
    local out="$THUMB_DIR/$viz.png"
    echo "  $viz..."
    "$CDP_SCRIPT" --port "$PORT" --width "$W" --height "$H" \
        -n "$url" -o "$out" --colorful --threshold 40 "$@"
}

echo "Taking thumbnails (${W}x${H})..."
echo ""

# --- DAG visualizations ---
# Strategy: select 2 domains (d1 + d2) for maximum color coverage

take_thumb cytoscape \
    -c "__cyClick('d1'); __cyClick('d2'); void 0"

take_thumb d3dag \
    -c "window.postMessage({type:'sync-select',nodeId:'d1'},'*'); void 0" \
    --click-retry "window.postMessage({type:'sync-select',nodeId:'d2'},'*'); void 0"

take_thumb forcegraph \
    -c "window.postMessage({type:'sync-select',nodeId:'d1'},'*'); void 0" \
    --click-retry "window.postMessage({type:'sync-select',nodeId:'d2'},'*'); void 0"

if [[ "$BASE_URL" == http* ]]; then
    take_thumb orb \
        -c "__orbClick('d1'); __orbClick('d2'); void 0" \
        --click-retry "window.postMessage({type:'sync-select',nodeId:'d1'},'*'); void 0"
else
    echo "  orb... SKIPPED (requires HTTP)"
fi

take_thumb reagraph \
    -c "__reagraphClick('d1'); __reagraphClick('d2'); void 0" \
    --click-retry "window.postMessage({type:'sync-select',nodeId:'d1'},'*'); void 0"

take_thumb sigma \
    -c "__sigmaClick('d1'); __sigmaClick('d2'); void 0" \
    --click-retry "window.postMessage({type:'sync-select',nodeId:'d1'},'*'); void 0"

take_thumb visnetwork \
    -c "window.postMessage({type:'sync-select',nodeId:'d1'},'*'); void 0" \
    --click-retry "window.postMessage({type:'sync-select',nodeId:'d2'},'*'); void 0"

# --- Venn visualizations ---
take_thumb venn \
    -c "__vennClick('Engineering'); void 0" \
    --click-retry "__vennClick('Science'); void 0"

take_thumb venn-enhanced \
    -c "__vennEnhancedClick('Engineering'); void 0" \
    --click-retry "__vennEnhancedClick('Science'); void 0"

# --- Dual panels (need more wait time for iframes) ---
take_thumb dual-v1 -w 6 \
    -c "window.postMessage({type:'sync-select',nodeId:'d1'},'*'); void 0" \
    --click-retry "window.postMessage({type:'sync-select',nodeId:'d2'},'*'); void 0"

take_thumb dual-all -w 6 \
    -c "document.querySelectorAll('iframe').forEach(f => f.contentWindow?.postMessage({type:'sync-select',nodeId:'d1'},'*')); void 0" \
    --click-retry "document.querySelectorAll('iframe').forEach(f => f.contentWindow?.postMessage({type:'sync-select',nodeId:'d2'},'*')); void 0"

echo ""
echo "Thumbnails saved to $THUMB_DIR/"
echo ""
echo "Optimize with: optipng -o2 $THUMB_DIR/*.png"
