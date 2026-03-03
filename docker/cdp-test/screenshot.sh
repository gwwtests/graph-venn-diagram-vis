#!/bin/bash
# Take a screenshot via CDP and optionally resize for repo efficiency
# Usage: screenshot.sh [CDP_HOST:PORT] [OUTPUT_FILE] [RESIZE_WxH]
# Example: screenshot.sh localhost:9222 /tmp/shot.png 600x400

CDP_ENDPOINT="${1:-localhost:9222}"
OUTPUT="${2:-/tmp/screenshot.png}"
RESIZE="${3:-600x400}"

# Get the first page/tab target
TARGET=$(curl -s "http://${CDP_ENDPOINT}/json" | node -e "
  const data = require('fs').readFileSync('/dev/stdin','utf8');
  const tabs = JSON.parse(data);
  const page = tabs.find(t => t.type === 'page');
  if (page) console.log(page.webSocketDebuggerUrl);
")

if [ -z "$TARGET" ]; then
  echo "ERROR: No page target found at ${CDP_ENDPOINT}" >&2
  exit 1
fi

# Take screenshot via CDP protocol
SCREENSHOT_B64=$(node -e "
const WebSocket = require('ws');
const ws = new WebSocket('${TARGET}');
ws.on('open', () => {
  ws.send(JSON.stringify({id:1, method:'Page.captureScreenshot', params:{format:'png'}}));
});
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.id === 1 && msg.result) {
    process.stdout.write(msg.result.data);
    ws.close();
  }
});
ws.on('error', (e) => { console.error(e.message); process.exit(1); });
" 2>/dev/null)

if [ -z "$SCREENSHOT_B64" ]; then
  echo "ERROR: Failed to capture screenshot" >&2
  exit 1
fi

# Decode and save
echo "$SCREENSHOT_B64" | base64 -d > "${OUTPUT}.full.png"

# Resize for repo efficiency
convert "${OUTPUT}.full.png" -resize "${RESIZE}" -quality 85 "$OUTPUT"
rm -f "${OUTPUT}.full.png"

echo "Screenshot saved: $OUTPUT (resized to ${RESIZE})"
ls -lh "$OUTPUT"
