#!/usr/bin/env bash
# Create a static demo snapshot from current Vite builds.
#
# Usage: ./demos/snapshot.sh [name]
#
# If name is omitted, uses the current git tag or short commit hash.
# Builds all visualizations, copies dist-* into demos/{name}/, fixes
# asset paths for file:// compatibility, and generates landing pages.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# All visualization targets (must match vite.{name}.config.ts)
ALL_VIZS=(cytoscape d3dag forcegraph orb reagraph sigma visnetwork venn venn-enhanced dual)

declare -A LABELS=(
  [cytoscape]="Cytoscape.js + dagre"
  [d3dag]="D3.js + d3-dag (Sugiyama)"
  [forcegraph]="force-graph (vasturiano)"
  [orb]="@memgraph/orb + dagre"
  [reagraph]="reagraph (WebGL/React)"
  [sigma]="Sigma.js v3 + graphology"
  [visnetwork]="vis-network (hierarchical)"
  [venn]="Venn Diagram (upsetjs/venn.js)"
  [venn-enhanced]="Enhanced Venn (domains + categories + entities)"
  [dual]="Dual Panel (DAG + Venn synchronized)"
)

# Determine snapshot name
if [ $# -ge 1 ]; then
  SNAP_NAME="$1"
else
  SNAP_NAME=$(cd "$PROJECT_DIR" && git describe --tags --exact-match 2>/dev/null || git rev-parse --short HEAD)
fi

SNAP_DIR="$SCRIPT_DIR/$SNAP_NAME"

if [ -d "$SNAP_DIR" ]; then
  echo "Snapshot '$SNAP_NAME' already exists at: $SNAP_DIR"
  echo "Remove it first or choose a different name."
  exit 1
fi

echo "Creating snapshot: $SNAP_NAME"
echo ""

# Build all visualizations
echo "Building visualizations..."
for viz in "${ALL_VIZS[@]}"; do
  config="$PROJECT_DIR/vite.${viz}.config.ts"
  dist="$PROJECT_DIR/dist-${viz}"

  if [ ! -f "$config" ]; then
    echo "  SKIP $viz (no config: vite.${viz}.config.ts)"
    continue
  fi

  echo -n "  Building $viz..."
  (cd "$PROJECT_DIR" && npx vite build --config "vite.${viz}.config.ts" > /dev/null 2>&1)
  echo " done"
done
echo ""

# Copy and fix each visualization
echo "Copying to demos/$SNAP_NAME/..."
mkdir -p "$SNAP_DIR"

for viz in "${ALL_VIZS[@]}"; do
  dist="$PROJECT_DIR/dist-${viz}"
  if [ ! -d "$dist" ] || [ ! -f "$dist/index.html" ]; then
    echo "  SKIP $viz (not built)"
    continue
  fi

  dest="$SNAP_DIR/$viz"
  cp -r "$dist" "$dest"

  # Fix for file:// compatibility:
  # 1. Absolute asset paths → relative: /assets/ → ./assets/
  find "$dest" -name '*.html' -exec sed -i \
    -e 's|="/assets/|="./assets/|g' \
    -e "s|='/assets/|='./assets/|g" \
    {} +

  # 2. If JS bundles use import.meta (e.g. orb's Web Workers), they MUST
  #    remain as type="module" — these only work via HTTP, not file://.
  #    Otherwise, remove type="module" and crossorigin (ES modules enforce
  #    CORS which blocks file://). Vite bundles are IIFEs so this is safe.
  #    Add defer to replace the implicit deferral of type="module".
  has_import_meta=false
  if grep -rql 'import\.meta' "$dest/assets/" 2>/dev/null; then
    has_import_meta=true
  fi

  if [ "$has_import_meta" = false ]; then
    find "$dest" -name '*.html' -exec sed -i \
      -e 's| type="module"||g' \
      -e 's| crossorigin||g' \
      -e 's|<script src=|<script defer src=|g' \
      {} +
  else
    # Keep type="module" but remove crossorigin for HTTP-served modules.
    # Also fix absolute asset paths inside JS bundles (e.g. worker URLs).
    find "$dest" -name '*.html' -exec sed -i \
      -e 's| crossorigin||g' \
      {} +
    # Fix worker URLs in JS: new URL("/assets/file", import.meta.url)
    # Since the JS file is already inside assets/, the path should be
    # relative to the same directory: "./file" not "/assets/file"
    find "$dest/assets" -name '*.js' -exec sed -i \
      -e 's|"/assets/|"./|g' \
      {} +
    echo "    (requires HTTP server — uses import.meta)"
  fi

  # Remove source maps (not needed for demos)
  find "$dest" -name '*.js.map' -delete 2>/dev/null || true

  echo "  $viz → demos/$SNAP_NAME/$viz/"
done
echo ""

# Generate snapshot landing page
echo "Generating demos/$SNAP_NAME/index.html..."
cat > "$SNAP_DIR/index.html" << 'HEADER'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Demo Snapshot</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #1a1a2e; color: #e0e0e0; font-family: system-ui, sans-serif; padding: 2rem; }
    h1 { color: #00d4ff; margin-bottom: 0.5rem; }
    .meta { color: #888; margin-bottom: 2rem; font-size: 0.9rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
    .card { background: #16213e; border: 1px solid #0f3460; border-radius: 8px; padding: 1.2rem;
            text-decoration: none; color: inherit; transition: border-color 0.2s, transform 0.1s; }
    .card:hover { border-color: #00d4ff; transform: translateY(-2px); }
    .card h2 { color: #00d4ff; font-size: 1.1rem; margin-bottom: 0.4rem; }
    .card p { color: #aaa; font-size: 0.85rem; }
    .back { display: inline-block; margin-bottom: 1.5rem; color: #00d4ff; text-decoration: none; }
    .back:hover { text-decoration: underline; }
  </style>
</head>
<body>
HEADER

# Add title with snapshot name
cat >> "$SNAP_DIR/index.html" << EOF
  <a class="back" href="../index.html">&larr; All Snapshots</a>
  <h1>Snapshot: $SNAP_NAME</h1>
  <p class="meta">Created $(date +%Y-%m-%d) &middot; $(cd "$PROJECT_DIR" && git rev-parse --short HEAD)</p>
  <div class="grid">
EOF

for viz in "${ALL_VIZS[@]}"; do
  if [ -d "$SNAP_DIR/$viz" ]; then
    label="${LABELS[$viz]}"
    cat >> "$SNAP_DIR/index.html" << EOF
    <a class="card" href="./$viz/index.html">
      <h2>$viz</h2>
      <p>$label</p>
    </a>
EOF
  fi
done

cat >> "$SNAP_DIR/index.html" << 'FOOTER'
  </div>
</body>
</html>
FOOTER

# Update top-level demos/index.html
echo "Updating demos/index.html..."
cat > "$SCRIPT_DIR/index.html" << 'HEADER'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Graph &amp; Venn Diagram Visualizations — Demos</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #1a1a2e; color: #e0e0e0; font-family: system-ui, sans-serif; padding: 2rem; }
    h1 { color: #00d4ff; margin-bottom: 0.5rem; }
    .subtitle { color: #888; margin-bottom: 2rem; }
    .snapshots { list-style: none; }
    .snapshots li { margin-bottom: 0.8rem; }
    .snapshots a { color: #00d4ff; text-decoration: none; font-size: 1.1rem; }
    .snapshots a:hover { text-decoration: underline; }
    .snapshots .meta { color: #666; font-size: 0.85rem; margin-left: 0.5rem; }
  </style>
</head>
<body>
  <h1>Graph &amp; Venn Diagram Visualizations</h1>
  <p class="subtitle">Static demo snapshots — open from disk or serve via any HTTP server</p>
  <ul class="snapshots">
HEADER

# List all snapshot directories (sorted, newest first by directory mtime)
for snap_dir in $(find "$SCRIPT_DIR" -mindepth 1 -maxdepth 1 -type d | sort -r); do
  snap=$(basename "$snap_dir")
  if [ -f "$snap_dir/index.html" ]; then
    viz_count=$(find "$snap_dir" -mindepth 1 -maxdepth 1 -type d | wc -l)
    cat >> "$SCRIPT_DIR/index.html" << EOF
    <li><a href="./$snap/index.html">$snap</a><span class="meta">($viz_count visualizations)</span></li>
EOF
  fi
done

cat >> "$SCRIPT_DIR/index.html" << 'FOOTER'
  </ul>
</body>
</html>
FOOTER

echo ""
echo "Snapshot created: demos/$SNAP_NAME/"
echo "Open demos/$SNAP_NAME/index.html in a browser to view."
