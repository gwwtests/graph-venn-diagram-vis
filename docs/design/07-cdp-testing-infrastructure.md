# CDP Testing Infrastructure

How to use the Docker-based headless Chromium environment for testing visualization implementations.

## Architecture

```
Host Machine
├── manage-cdp.sh          # Management script (build/start/stop/screenshot)
├── docker/cdp-test/
│   ├── Dockerfile          # Chromium + socat + imagemagick + node serve
│   └── entrypoint.sh       # Starts HTTP server, Chromium, socat CDP proxy
└── dist-{library}/         # Built visualization files (mounted into container)
    └── index.html          # Visualization page to test

Docker Container (one per library)
├── /srv/app/               # Mounted from dist-{library}/ (read-only)
├── serve (port 8080)       # Static HTTP server
├── chromium (port 9222)    # Headless Chromium with CDP (localhost only)
└── socat (port 9223)       # Proxies 0.0.0.0:9223 → 127.0.0.1:9222
```

## Quick Start

```bash
# 1. Build the Docker image (one time)
./manage-cdp.sh build

# 2. Start a container for your library
#    ./manage-cdp.sh start <NAME> <CDP_PORT> <HTTP_PORT> <APP_DIR>
./manage-cdp.sh start cytoscape 9301 8301 dist-cytoscape

# 3. Take a screenshot (resized for repo)
#    ./manage-cdp.sh screenshot <NAME> <OUTPUT> [WxH]
./manage-cdp.sh screenshot cytoscape assets/screenshots/cytoscape-dag.png 600x400

# 4. Stop the container
./manage-cdp.sh stop cytoscape
```

## Port Assignments

Each visualization agent gets a unique CDP and HTTP port pair to avoid collisions:

| Library | Name | CDP Port | HTTP Port |
|---------|------|----------|-----------|
| Cytoscape.js | cytoscape | 9301 | 8301 |
| vis-network | visnetwork | 9302 | 8302 |
| force-graph | forcegraph | 9303 | 8303 |
| D3 + d3-dag | d3dag | 9304 | 8304 |
| reagraph | reagraph | 9305 | 8305 |
| Sigma.js | sigma | 9306 | 8306 |
| @memgraph/orb | orb | 9307 | 8307 |

## Management Commands

```bash
./manage-cdp.sh build                              # Build Docker image
./manage-cdp.sh start <NAME> <CDP> <HTTP> <DIR>    # Start container
./manage-cdp.sh stop <NAME>                         # Stop container
./manage-cdp.sh status                              # List all CDP containers
./manage-cdp.sh screenshot <NAME> <OUT> [WxH]       # Take screenshot (default 600x400)
./manage-cdp.sh cleanup                             # Remove all CDP containers
```

## How to Build a Visualization for Testing

Each visualization implementation must produce a **self-contained static directory** that can be served by `npx serve`.

### Required Output Structure

```
dist-{library}/
├── index.html          # Main page (loads the visualization)
├── *.js                # Bundled JavaScript
└── *.css               # Optional styles
```

### Build Process

1. **Create source files** in `src/vis/{library}/`
2. **Add a vite config** or build script that outputs to `dist-{library}/`
3. **Build**: `npx vite build --config vite.{library}.config.ts`
4. **Verify** the `dist-{library}/` directory contains a working `index.html`

### Visualization Page Requirements

The `index.html` must:

* Load the master graph from the engine
* Render the DAG with all 14 nodes (3 domains, 5 categories, 6 entities)
* Show proper hierarchical layout (domains top, categories middle, entities bottom)
* Style nodes with selected/unselected states
* Display path counts on entity nodes
* Support click interactions (select/deselect domains)

### Minimal index.html Template

```html
<!DOCTYPE html>
<html>
<head>
  <title>DAG - {Library Name}</title>
  <style>
    body { margin: 0; font-family: sans-serif; background: #1a1a2e; }
    #graph { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <div id="graph"></div>
  <script type="module" src="./main.js"></script>
</body>
</html>
```

## Taking Screenshots

### From manage-cdp.sh

```bash
# Default 600x400 resize
./manage-cdp.sh screenshot cytoscape assets/screenshots/cytoscape-dag.png

# Custom size
./manage-cdp.sh screenshot cytoscape assets/screenshots/cytoscape-dag.png 800x600
```

### Manual CDP Screenshot (via curl + node)

```bash
CDP_HOST="127.0.0.1:9301"

# Get WebSocket URL for the page
WS_URL=$(curl -4 -s "http://${CDP_HOST}/json" | node -e "
  let d='';
  process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{
    const t=JSON.parse(d);
    const p=t.find(x=>x.type==='page');
    if(p) console.log(p.webSocketDebuggerUrl);
  });
")

# Take screenshot via native WebSocket (Node 22+)
node -e "
  const fs = require('fs');
  const ws = new WebSocket('${WS_URL}');
  ws.onopen = () => {
    ws.send(JSON.stringify({id:1, method:'Page.captureScreenshot', params:{format:'png'}}));
  };
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id === 1 && msg.result) {
      fs.writeFileSync('/tmp/screenshot.png', Buffer.from(msg.result.data, 'base64'));
      ws.close();
      process.exit(0);
    }
  };
"

# Resize for repo (use magick or convert)
magick /tmp/screenshot.png -resize 600x400 -quality 85 assets/screenshots/output.png
```

### CDP DOM Inspection

```bash
# Navigate to a URL
node -e "
  const ws = new WebSocket('${WS_URL}');
  ws.onopen = () => {
    ws.send(JSON.stringify({id:1, method:'Runtime.evaluate', params:{expression:'document.title'}}));
  };
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id === 1) { console.log(JSON.stringify(msg.result, null, 2)); ws.close(); process.exit(0); }
  };
"
```

## Screenshot Guidelines for Repository

* **Target resolution**: 600x400 pixels (or proportional, fitting within 600px width)
* **Format**: PNG with quality 85
* **File size**: Aim for under 50KB per screenshot
* **Location**: `assets/screenshots/{library}-{description}.png`
* **Naming**: `cytoscape-dag-default.png`, `cytoscape-dag-selected.png`, etc.
* **Per library**: Up to 3 screenshots showing best results

## Troubleshooting

### CDP connection fails

Always use `127.0.0.1` not `localhost` — socat binds IPv4 only.

```bash
# Correct
curl -4 -s http://127.0.0.1:9301/json/version

# May fail (resolves to IPv6)
curl -s http://localhost:9301/json/version
```

### Container starts but page is blank

Check the app directory has an `index.html`:

```bash
ls dist-{library}/index.html
```

Check container logs:

```bash
docker logs gvdv-cdp-{name} 2>&1 | tail -20
```

### dbus errors in logs

These are harmless — Chromium wants D-Bus but it's not available in the container. They don't affect rendering or screenshots.

## Docker Image Details

* **Base**: `node:22-slim` (Debian bookworm)
* **Chromium**: Debian package (headless mode)
* **Image name**: `gvdv-cdp-test`
* **Container prefix**: `gvdv-cdp-{name}`
* **Prefix override**: `GVDV_DOCKER_PREFIX=myprefix ./manage-cdp.sh ...`
