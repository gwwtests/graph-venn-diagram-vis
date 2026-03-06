#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["websocket-client"]
# ///
"""Navigate to URL, click a node by text, then screenshot.

Usage: ./scripts/cdp-click-and-screenshot.py --port PORT --navigate URL --click "NodeText" -o output.png
"""
import argparse
import base64
import json
import time
import urllib.request

import websocket


def send_cmd(ws, msg_id, method, params=None):
    cmd = {"id": msg_id, "method": method}
    if params:
        cmd["params"] = params
    ws.send(json.dumps(cmd))
    while True:
        resp = json.loads(ws.recv())
        if resp.get("id") == msg_id:
            return resp, msg_id + 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=9337)
    parser.add_argument("--navigate", "-n", required=True)
    parser.add_argument("--output", "-o", required=True)
    parser.add_argument("--click", "-c", default=None, help="JS expression to click element")
    parser.add_argument("--wait", "-w", type=float, default=4.0)
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=720)
    args = parser.parse_args()

    tabs = json.loads(urllib.request.urlopen(f"http://localhost:{args.port}/json").read())
    tab = next(t for t in tabs if t.get("type") == "page")
    ws = websocket.create_connection(tab["webSocketDebuggerUrl"])
    msg_id = 1

    # Set viewport size
    _, msg_id = send_cmd(ws, msg_id, "Emulation.setDeviceMetricsOverride", {
        "width": args.width, "height": args.height,
        "deviceScaleFactor": 1, "mobile": False
    })

    # Navigate
    _, msg_id = send_cmd(ws, msg_id, "Page.navigate", {"url": args.navigate})
    time.sleep(args.wait)

    # Execute click JS if provided
    if args.click:
        _, msg_id = send_cmd(ws, msg_id, "Runtime.evaluate", {
            "expression": args.click, "returnByValue": True
        })
        time.sleep(2)

    # Screenshot
    result, msg_id = send_cmd(ws, msg_id, "Page.captureScreenshot", {"format": "png"})
    img_data = base64.b64decode(result["result"]["data"])
    with open(args.output, "wb") as f:
        f.write(img_data)
    print(f"Screenshot: {args.output} ({len(img_data)} bytes)")

    # Reset viewport
    _, msg_id = send_cmd(ws, msg_id, "Emulation.clearDeviceMetricsOverride")

    ws.close()


if __name__ == "__main__":
    main()
