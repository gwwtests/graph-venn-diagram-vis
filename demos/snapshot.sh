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
ALL_VIZS=(cytoscape d3dag forcegraph orb reagraph sigma visnetwork venn venn-enhanced dual-v1 dual-all)

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
  [dual-v1]="Dual Panel v1 (DAG + Venn synchronized)"
  [dual-all]="Dual Panel All (any renderer, iframe-based)"
)

# Inject file:// protocol info overlay into an HTML file.
# Called for visualizations that use import.meta (Web Workers) and
# therefore cannot work from file:// URLs.
_inject_file_protocol_info() {
  local html_file="$1"
  local viz_name="$2"
  local label="${LABELS[$viz_name]:-$viz_name}"

  # Inject CSS + overlay div + detection script before </body>
  sed -i '/<\/body>/i \
  <style>\
    #file-protocol-info {\
      display: none; position: fixed; inset: 0;\
      background: #1a1a2e; color: #e0e0e0;\
      font-family: system-ui, -apple-system, sans-serif;\
      padding: 3rem 2rem; z-index: 9999; overflow-y: auto;\
    }\
    #file-protocol-info h1 { color: #00d4ff; margin-bottom: 0.5rem; font-size: 1.6rem; }\
    #file-protocol-info .subtitle { color: #888; margin-bottom: 2rem; font-size: 0.95rem; }\
    #file-protocol-info h2 { color: #00d4ff; font-size: 1.1rem; margin: 1.5rem 0 0.5rem; }\
    #file-protocol-info p { line-height: 1.6; margin-bottom: 0.8rem; max-width: 700px; }\
    #file-protocol-info code {\
      background: #16213e; border: 1px solid #0f3460; border-radius: 4px;\
      padding: 0.15em 0.4em; font-size: 0.9em; color: #00d4ff;\
    }\
    #file-protocol-info pre {\
      background: #16213e; border: 1px solid #0f3460; border-radius: 6px;\
      padding: 1rem; margin: 0.8rem 0 1.2rem; overflow-x: auto; max-width: 700px;\
    }\
    #file-protocol-info pre code { background: none; border: none; padding: 0; color: #e0e0e0; }\
    #file-protocol-info a { color: #00d4ff; text-decoration: none; }\
    #file-protocol-info a:hover { text-decoration: underline; }\
    #file-protocol-info .note {\
      background: #16213e; border-left: 3px solid #00d4ff; border-radius: 4px;\
      padding: 0.8rem 1rem; margin: 1rem 0; max-width: 700px;\
    }\
  </style>\
  <div id="file-protocol-info">\
    <h1>'"$label"' — HTTP Server Required</h1>\
    <p class="subtitle">This visualization cannot run from <code>file:///</code> URLs.</p>\
    <h2>Why is the page blank?</h2>\
    <p>This visualization uses <strong>Web Workers</strong> via <code>import.meta</code>.\
    Browsers block Web Worker creation from <code>file:///</code> due to CORS \\/ same-origin restrictions.\
    All other demo visualizations work from <code>file:///</code> — only this one has this limitation.</p>\
    <h2>How to view this demo</h2>\
    <p>Serve the demos directory with any HTTP server:</p>\
    <pre><code># Option A — Python\\npython3 -m http.server 8234 -d demos\\n\\n# Option B — Node \\/ npx\\nnpx serve demos -l 8234</code></pre>\
    <p>Then open: <a href="http://localhost:8234/">http://localhost:8234/</a> and navigate to this visualization.</p>\
    <div class="note">Or use the helper script from the repo root: <code>.\\\/serve-demos.sh '"$viz_name"'</code></div>\
  </div>\
  <script>\
    if (window.location.protocol === "file:") {\
      document.getElementById("file-protocol-info").style.display = "block";\
      var graph = document.getElementById("graph");\
      if (graph) graph.style.display = "none";\
    }\
  </script>' "$html_file"
}

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

    # Inject file:// protocol info overlay for import.meta visualizations
    # (e.g. orb). Shows helpful instructions instead of a blank page.
    _inject_file_protocol_info "$dest/index.html" "$viz"
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
    .card { background: #16213e; border: 1px solid #0f3460; border-radius: 8px;
            text-decoration: none; color: inherit; transition: border-color 0.2s, transform 0.1s;
            overflow: hidden; }
    .card:hover { border-color: #00d4ff; transform: translateY(-2px); }
    .card img { width: 100%; height: 160px; object-fit: cover; display: block;
                border-bottom: 1px solid #0f3460; }
    .card .info { padding: 0.8rem 1rem; }
    .card h2 { color: #00d4ff; font-size: 1.1rem; margin-bottom: 0.3rem; }
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
    thumb_img=""
    if [ -f "$SNAP_DIR/thumbnails/$viz.png" ]; then
      thumb_img="      <img src=\"./thumbnails/$viz.png\" alt=\"$viz preview\" loading=\"lazy\">"
    fi
    http_note=""
    if [ "$has_import_meta" = true ] 2>/dev/null && grep -rql 'import\.meta' "$SNAP_DIR/$viz/assets/" 2>/dev/null; then
      http_note=" <em style=\"color:#e6a800;\">(HTTP server required)</em>"
    fi
    cat >> "$SNAP_DIR/index.html" << EOF
    <a class="card" href="./$viz/index.html">
$thumb_img
      <div class="info">
        <h2>$viz</h2>
        <p>$label$http_note</p>
      </div>
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
