#!/bin/bash
# CDP Test Container Management Script
# Manages Docker containers running headless Chromium with CDP for visualization testing
#
# Usage:
#   ./manage-cdp.sh build                    Build the CDP test image
#   ./manage-cdp.sh start <NAME> <CDP_PORT> <HTTP_PORT> <APP_DIR>
#                                             Start a container
#   ./manage-cdp.sh stop <NAME>              Stop and remove a container
#   ./manage-cdp.sh status                   Show all running CDP containers
#   ./manage-cdp.sh screenshot <NAME> <OUTPUT> [RESIZE]
#                                             Take a screenshot from a running container
#   ./manage-cdp.sh cleanup                  Stop and remove all CDP containers
#
# Examples:
#   ./manage-cdp.sh build
#   ./manage-cdp.sh start cytoscape 9301 8301 dist-cytoscape
#   ./manage-cdp.sh screenshot cytoscape assets/screenshots/cytoscape.png 600x400
#   ./manage-cdp.sh stop cytoscape
#   ./manage-cdp.sh cleanup

set -e

PREFIX="${GVDV_DOCKER_PREFIX:-gvdv}"
IMAGE="${PREFIX}-cdp-test"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

cmd_build() {
  echo "Building CDP test image: ${IMAGE}"
  docker build -t "${IMAGE}" "${SCRIPT_DIR}/docker/cdp-test/"
  echo "Done. Image: ${IMAGE}"
}

cmd_start() {
  local name="${1:?Usage: start <NAME> <CDP_PORT> <HTTP_PORT> <APP_DIR>}"
  local cdp_port="${2:?Missing CDP_PORT}"
  local http_port="${3:?Missing HTTP_PORT}"
  local app_dir="${4:?Missing APP_DIR (relative to project root)}"
  local container="${PREFIX}-cdp-${name}"
  local abs_app_dir="${SCRIPT_DIR}/${app_dir}"

  if [ ! -d "$abs_app_dir" ]; then
    echo "ERROR: App directory does not exist: ${abs_app_dir}" >&2
    exit 1
  fi

  # Check if already running
  if docker ps -q -f "name=${container}" | grep -q .; then
    echo "Container ${container} already running (CDP: ${cdp_port}, HTTP: ${http_port})"
    return 0
  fi

  # Remove stopped container if exists
  docker rm -f "${container}" 2>/dev/null || true

  echo "Starting ${container} (CDP: ${cdp_port}, HTTP: ${http_port}, App: ${app_dir})"
  docker run -d \
    --name "${container}" \
    -p "${cdp_port}:9223" \
    -p "${http_port}:8080" \
    -v "${abs_app_dir}:/srv/app:ro" \
    "${IMAGE}"

  # Wait for CDP to be ready
  echo -n "Waiting for CDP..."
  for i in $(seq 1 30); do
    if curl -s "http://127.0.0.1:${cdp_port}/json/version" > /dev/null 2>&1; then
      echo " ready!"
      curl -s "http://127.0.0.1:${cdp_port}/json/version" | python3 -m json.tool 2>/dev/null || true
      return 0
    fi
    echo -n "."
    sleep 1
  done
  echo " TIMEOUT"
  echo "Container logs:"
  docker logs "${container}" 2>&1 | tail -20
  return 1
}

cmd_stop() {
  local name="${1:?Usage: stop <NAME>}"
  local container="${PREFIX}-cdp-${name}"
  echo "Stopping ${container}..."
  docker rm -f "${container}" 2>/dev/null && echo "Removed." || echo "Not found."
}

cmd_status() {
  echo "CDP test containers (prefix: ${PREFIX}-cdp-):"
  docker ps -a --filter "name=${PREFIX}-cdp-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

cmd_screenshot() {
  local name="${1:?Usage: screenshot <NAME> <OUTPUT> [RESIZE]}"
  local output="${2:?Missing OUTPUT file path}"
  local resize="${3:-600x400}"
  local container="${PREFIX}-cdp-${name}"

  # Find CDP port for this container
  local cdp_port
  cdp_port=$(docker port "${container}" 9223/tcp 2>/dev/null | head -1 | cut -d: -f2)
  if [ -z "$cdp_port" ]; then
    echo "ERROR: Cannot find CDP port for ${container}. Is it running?" >&2
    exit 1
  fi

  local cdp_host="127.0.0.1:${cdp_port}"
  echo "Taking screenshot from ${container} (CDP: ${cdp_host})..."

  # Get websocket URL for the page
  local ws_url
  ws_url=$(curl -s "http://${cdp_host}/json" | node -e "
    let d='';
    process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      const tabs=JSON.parse(d);
      const page=tabs.find(t=>t.type==='page');
      if(page) console.log(page.webSocketDebuggerUrl);
    });
  ")

  if [ -z "$ws_url" ]; then
    echo "ERROR: No page target found" >&2
    exit 1
  fi

  # Ensure output directory exists
  mkdir -p "$(dirname "$output")"

  # Take screenshot via CDP using node native WebSocket (Node 22+)
  local tmp_full="/tmp/${PREFIX}-screenshot-$$.png"
  node -e "
    const fs = require('fs');
    const ws = new WebSocket('${ws_url}');
    const timer = setTimeout(() => { console.error('Timeout'); process.exit(1); }, 10000);
    ws.onopen = () => {
      ws.send(JSON.stringify({id:1, method:'Page.captureScreenshot', params:{format:'png'}}));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 1 && msg.result) {
        fs.writeFileSync('${tmp_full}', Buffer.from(msg.result.data, 'base64'));
        clearTimeout(timer);
        ws.close();
        process.exit(0);
      }
    };
    ws.onerror = (e) => { console.error('WS error:', e.message); process.exit(1); };
  "

  if [ ! -f "$tmp_full" ]; then
    echo "ERROR: Screenshot capture failed" >&2
    exit 1
  fi

  # Resize for repo efficiency (use magick if available, fallback to convert)
  local img_cmd="convert"
  command -v magick > /dev/null 2>&1 && img_cmd="magick"
  $img_cmd "$tmp_full" -resize "${resize}" -quality 85 "$output"
  rm -f "$tmp_full"

  local size
  size=$(ls -lh "$output" | awk '{print $5}')
  echo "Screenshot saved: ${output} (${resize}, ${size})"
}

cmd_cleanup() {
  echo "Stopping all CDP containers with prefix ${PREFIX}-cdp-..."
  docker ps -a -q --filter "name=${PREFIX}-cdp-" | xargs -r docker rm -f
  echo "Done."
}

# Dispatch
case "${1:-}" in
  build)      cmd_build ;;
  start)      cmd_start "${@:2}" ;;
  stop)       cmd_stop "${@:2}" ;;
  status)     cmd_status ;;
  screenshot) cmd_screenshot "${@:2}" ;;
  cleanup)    cmd_cleanup ;;
  *)
    echo "Usage: $0 {build|start|stop|status|screenshot|cleanup}"
    echo ""
    echo "Commands:"
    echo "  build                              Build the CDP test Docker image"
    echo "  start <NAME> <CDP_PORT> <HTTP_PORT> <APP_DIR>"
    echo "                                     Start a named container"
    echo "  stop <NAME>                        Stop and remove a container"
    echo "  status                             List all CDP containers"
    echo "  screenshot <NAME> <OUT> [WxH]      Capture screenshot (default 600x400)"
    echo "  cleanup                            Remove all CDP containers"
    exit 1
    ;;
esac
