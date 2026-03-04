#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["websocket-client"]
# ///
"""Capture browser console messages via CDP.

Usage: ./scripts/cdp-console-log.py [--port PORT] [--navigate URL] [--wait SECS]
"""
import argparse
import json
import time
import urllib.request

import websocket


def main():
    parser = argparse.ArgumentParser(description="CDP console log capture")
    parser.add_argument("--port", type=int, default=9337)
    parser.add_argument("--navigate", "-n", default=None)
    parser.add_argument("--wait", "-w", type=float, default=3.0)
    args = parser.parse_args()

    tabs = json.loads(urllib.request.urlopen(f"http://localhost:{args.port}/json").read())
    tab = next(t for t in tabs if t.get("type") == "page")
    ws = websocket.create_connection(tab["webSocketDebuggerUrl"])
    msg_id = 1

    def send(method, params=None):
        nonlocal msg_id
        cmd = {"id": msg_id, "method": method}
        if params:
            cmd["params"] = params
        ws.send(json.dumps(cmd))
        msg_id += 1

    # Enable console and runtime
    send("Console.enable")
    send("Runtime.enable")
    send("Log.enable")

    if args.navigate:
        send("Page.enable")
        send("Page.navigate", {"url": args.navigate})

    # Collect messages for wait duration
    ws.settimeout(0.5)
    end_time = time.time() + args.wait
    messages = []

    while time.time() < end_time:
        try:
            resp = json.loads(ws.recv())
            method = resp.get("method", "")
            if method == "Console.messageAdded":
                msg = resp["params"]["message"]
                messages.append(f"[{msg.get('level', '?')}] {msg.get('text', '')}")
                if msg.get("url"):
                    messages[-1] += f"  ({msg['url']}:{msg.get('line', '?')})"
            elif method == "Runtime.consoleAPICalled":
                args_list = resp["params"].get("args", [])
                text = " ".join(a.get("value", a.get("description", str(a))) for a in args_list)
                messages.append(f"[{resp['params'].get('type', '?')}] {text}")
            elif method == "Runtime.exceptionThrown":
                exc = resp["params"]["exceptionDetails"]
                text = exc.get("text", "")
                if exc.get("exception"):
                    text += " " + exc["exception"].get("description", "")
                messages.append(f"[EXCEPTION] {text}")
            elif method == "Log.entryAdded":
                entry = resp["params"]["entry"]
                messages.append(f"[{entry.get('level', '?')}] {entry.get('text', '')}")
                if entry.get("url"):
                    messages[-1] += f"  ({entry['url']}:{entry.get('lineNumber', '?')})"
        except websocket.WebSocketTimeoutException:
            continue

    ws.close()

    if messages:
        for m in messages:
            print(m)
    else:
        print("(no console messages captured)")


if __name__ == "__main__":
    main()
