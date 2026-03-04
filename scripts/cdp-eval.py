#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["websocket-client"]
# ///
"""Evaluate JavaScript in browser via CDP.

Usage: ./scripts/cdp-eval.py --port PORT "javascript expression"
"""
import argparse
import json
import urllib.request

import websocket


def main():
    parser = argparse.ArgumentParser(description="CDP JavaScript evaluator")
    parser.add_argument("--port", type=int, default=9337)
    parser.add_argument("expression", help="JavaScript to evaluate")
    args = parser.parse_args()

    tabs = json.loads(urllib.request.urlopen(f"http://localhost:{args.port}/json").read())
    tab = next(t for t in tabs if t.get("type") == "page")
    ws = websocket.create_connection(tab["webSocketDebuggerUrl"])

    cmd = {"id": 1, "method": "Runtime.evaluate", "params": {
        "expression": args.expression,
        "returnByValue": True
    }}
    ws.send(json.dumps(cmd))

    while True:
        resp = json.loads(ws.recv())
        if resp.get("id") == 1:
            result = resp.get("result", {}).get("result", {})
            if result.get("type") == "undefined":
                print("undefined")
            elif "value" in result:
                val = result["value"]
                if isinstance(val, (dict, list)):
                    print(json.dumps(val, indent=2))
                else:
                    print(val)
            else:
                print(json.dumps(result, indent=2))
            break

    ws.close()


if __name__ == "__main__":
    main()
