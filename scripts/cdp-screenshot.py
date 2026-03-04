#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["websocket-client"]
# ///
"""Take CDP screenshot of a Chromium tab.

Usage: ./scripts/cdp-screenshot.py [--port PORT] [--output FILE] [--navigate URL]

Examples:
  ./scripts/cdp-screenshot.py
  ./scripts/cdp-screenshot.py --port 9337 --output /tmp/shot.png
  ./scripts/cdp-screenshot.py --navigate "file:///path/to/page.html" --output /tmp/shot.png
"""
import argparse
import base64
import json
import time
import urllib.request

import websocket


def get_page_tab(port: int) -> dict:
    tabs = json.loads(urllib.request.urlopen(f"http://localhost:{port}/json").read())
    return next(t for t in tabs if t.get("type") == "page")


def send_cmd(ws, msg_id: int, method: str, params: dict | None = None) -> tuple[dict, int]:
    cmd = {"id": msg_id, "method": method}
    if params:
        cmd["params"] = params
    ws.send(json.dumps(cmd))
    while True:
        resp = json.loads(ws.recv())
        if resp.get("id") == msg_id:
            return resp, msg_id + 1


def main():
    parser = argparse.ArgumentParser(description="CDP screenshot tool")
    parser.add_argument("--port", type=int, default=9337, help="CDP port (default: 9337)")
    parser.add_argument("--output", "-o", default="/tmp/claude/260304-chromium-demos/screenshot.png",
                        help="Output PNG path")
    parser.add_argument("--navigate", "-n", default=None, help="URL to navigate to before screenshot")
    parser.add_argument("--wait", "-w", type=float, default=3.0,
                        help="Seconds to wait after navigation (default: 3)")
    args = parser.parse_args()

    tab = get_page_tab(args.port)
    ws = websocket.create_connection(tab["webSocketDebuggerUrl"])
    msg_id = 1

    if args.navigate:
        _, msg_id = send_cmd(ws, msg_id, "Page.navigate", {"url": args.navigate})
        time.sleep(args.wait)

    result, msg_id = send_cmd(ws, msg_id, "Page.captureScreenshot", {"format": "png"})
    img_data = base64.b64decode(result["result"]["data"])

    with open(args.output, "wb") as f:
        f.write(img_data)
    print(f"Screenshot saved: {args.output} ({len(img_data)} bytes)")

    ws.close()


if __name__ == "__main__":
    main()
