#!/bin/bash
# Serve DAG visualization demos for side-by-side comparison
#
# Usage:
#   ./serve-demos.sh              Serve all 7 visualizations
#   ./serve-demos.sh cytoscape    Serve only cytoscape
#   ./serve-demos.sh stop         Stop all demo servers
#   ./serve-demos.sh list         Show available demos
#
# Each visualization runs on its own port (4201-4207).
# Click domain nodes (Engineering, Science, Arts) to see path count propagation.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Library → port mapping
declare -A PORTS=(
  [cytoscape]=4201
  [d3dag]=4202
  [forcegraph]=4203
  [orb]=4204
  [reagraph]=4205
  [sigma]=4206
  [visnetwork]=4207
)

declare -A LABELS=(
  [cytoscape]="Cytoscape.js + dagre"
  [d3dag]="D3.js + d3-dag (Sugiyama)"
  [forcegraph]="force-graph (vasturiano)"
  [orb]="@memgraph/orb + dagre"
  [reagraph]="reagraph (WebGL/React)"
  [sigma]="Sigma.js v3 + graphology"
  [visnetwork]="vis-network (hierarchical)"
)

ALL_LIBS=(cytoscape d3dag forcegraph orb reagraph sigma visnetwork)

cmd_list() {
  echo "Available DAG visualization demos:"
  echo ""
  for lib in "${ALL_LIBS[@]}"; do
    local dir="${SCRIPT_DIR}/dist-${lib}"
    local status="[not built]"
    [ -f "${dir}/index.html" ] && status="[ready]"
    printf "  %-14s %-35s port %d  %s\n" "$lib" "${LABELS[$lib]}" "${PORTS[$lib]}" "$status"
  done
  echo ""
  echo "Usage: $0 [lib...]   or   $0 stop"
}

cmd_stop() {
  echo "Stopping demo servers..."
  for lib in "${ALL_LIBS[@]}"; do
    local port="${PORTS[$lib]}"
    local pids
    pids=$(lsof -ti:${port} 2>/dev/null || true)
    if [ -n "$pids" ]; then
      echo "$pids" | xargs kill -15 2>/dev/null || true
      echo "  Stopped ${lib} (port ${port})"
    fi
  done
  echo "Done."
}

build_if_needed() {
  local lib="$1"
  local dir="${SCRIPT_DIR}/dist-${lib}"
  local config="${SCRIPT_DIR}/vite.${lib}.config.ts"

  if [ -f "${dir}/index.html" ]; then
    return 0
  fi

  if [ ! -f "$config" ]; then
    echo "  WARNING: No vite config for ${lib}, skipping" >&2
    return 1
  fi

  echo "  Building ${lib}..."
  (cd "$SCRIPT_DIR" && npx vite build --config "vite.${lib}.config.ts" > /dev/null 2>&1)
}

serve_lib() {
  local lib="$1"
  local port="${PORTS[$lib]}"
  local dir="${SCRIPT_DIR}/dist-${lib}"

  if ! build_if_needed "$lib"; then
    return 1
  fi

  # Check if port already in use
  if lsof -ti:${port} > /dev/null 2>&1; then
    echo "  http://localhost:${port}  →  ${LABELS[$lib]}  (already running)"
    return 0
  fi

  npx -y serve -l ${port} -s "${dir}" --no-clipboard > /dev/null 2>&1 &
  echo "  http://localhost:${port}  →  ${LABELS[$lib]}"
}

# Main dispatch
case "${1:-all}" in
  stop)
    cmd_stop
    ;;
  list)
    cmd_list
    ;;
  all)
    echo "Starting all DAG visualization demos..."
    echo ""
    for lib in "${ALL_LIBS[@]}"; do
      serve_lib "$lib"
    done
    echo ""
    echo "Click domain nodes (Engineering, Science, Arts) to interact."
    echo "Run '$0 stop' to stop all servers."
    ;;
  *)
    echo "Starting selected demos..."
    echo ""
    for lib in "$@"; do
      if [[ -v "PORTS[$lib]" ]]; then
        serve_lib "$lib"
      else
        echo "  Unknown library: ${lib}. Run '$0 list' to see options."
      fi
    done
    echo ""
    echo "Run '$0 stop' to stop servers."
    ;;
esac
