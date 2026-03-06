#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["websocket-client"]
# ///
"""Navigate to URL, click nodes, verify colorfulness, and screenshot.

Usage:
  ./scripts/cdp-click-and-screenshot.py --port PORT --navigate URL --click "JS_EXPR" -o output.png
  ./scripts/cdp-click-and-screenshot.py --port 9337 -n URL -c "JS_EXPR" -o out.png --colorful

With --colorful: analyzes screenshot pixel colors and retries clicks if too monotone.
"""
import argparse
import base64
import json
import struct
import time
import urllib.request
import zlib

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


def take_screenshot(ws, msg_id):
    """Capture screenshot and return (png_bytes, msg_id)."""
    result, msg_id = send_cmd(ws, msg_id, "Page.captureScreenshot", {"format": "png"})
    img_data = base64.b64decode(result["result"]["data"])
    return img_data, msg_id


def analyze_png_colors(png_bytes):
    """Analyze PNG pixel colors without PIL. Returns dict with color stats.

    Parses PNG IHDR + IDAT chunks, decompresses, samples pixels,
    and computes color diversity metrics.
    """
    # Parse PNG header
    if png_bytes[:8] != b'\x89PNG\r\n\x1a\n':
        return {"error": "not a PNG", "colorful_score": 0}

    pos = 8
    width = height = bit_depth = color_type = 0
    idat_chunks = []

    while pos < len(png_bytes):
        length = struct.unpack(">I", png_bytes[pos:pos+4])[0]
        chunk_type = png_bytes[pos+4:pos+8]
        chunk_data = png_bytes[pos+8:pos+8+length]
        pos += 12 + length  # 4 len + 4 type + data + 4 crc

        if chunk_type == b'IHDR':
            width = struct.unpack(">I", chunk_data[0:4])[0]
            height = struct.unpack(">I", chunk_data[4:8])[0]
            bit_depth = chunk_data[8]
            color_type = chunk_data[9]
        elif chunk_type == b'IDAT':
            idat_chunks.append(chunk_data)
        elif chunk_type == b'IEND':
            break

    if not idat_chunks or width == 0:
        return {"error": "no image data", "colorful_score": 0}

    # Decompress
    try:
        raw = zlib.decompress(b''.join(idat_chunks))
    except zlib.error:
        return {"error": "decompress failed", "colorful_score": 0}

    # Determine bytes per pixel
    if color_type == 2:    # RGB
        bpp = 3
    elif color_type == 6:  # RGBA
        bpp = 4
    else:
        return {"error": f"unsupported color_type={color_type}", "colorful_score": 0}

    stride = 1 + width * bpp  # 1 filter byte per row

    # Sample pixels (every 8th row, every 8th col for speed)
    color_counts = {}
    saturated_pixels = 0
    bright_pixels = 0
    total_sampled = 0
    hue_buckets = [0] * 12  # 12 hue sectors of 30 degrees

    step = 8
    for y in range(0, height, step):
        row_start = y * stride + 1  # skip filter byte
        for x in range(0, width, step):
            px_start = row_start + x * bpp
            if px_start + 3 > len(raw):
                continue
            r, g, b = raw[px_start], raw[px_start+1], raw[px_start+2]
            total_sampled += 1

            # Quantize to 32-level buckets for counting distinct colors
            qr, qg, qb = r >> 3, g >> 3, b >> 3
            key = (qr, qg, qb)
            color_counts[key] = color_counts.get(key, 0) + 1

            # Check saturation (non-gray)
            max_c = max(r, g, b)
            min_c = min(r, g, b)
            chroma = max_c - min_c

            if chroma > 40 and max_c > 60:
                saturated_pixels += 1
                # Rough hue bucket
                if max_c == r:
                    hue = ((g - b) / chroma) % 6
                elif max_c == g:
                    hue = (b - r) / chroma + 2
                else:
                    hue = (r - g) / chroma + 4
                bucket = int(hue * 2) % 12
                hue_buckets[bucket] += 1

            if max_c > 128:
                bright_pixels += 1

    if total_sampled == 0:
        return {"error": "no pixels sampled", "colorful_score": 0}

    distinct_colors = len(color_counts)
    saturation_ratio = saturated_pixels / total_sampled
    brightness_ratio = bright_pixels / total_sampled
    active_hues = sum(1 for h in hue_buckets if h > total_sampled * 0.005)

    # Colorful score: 0-100
    # Weights: distinct colors (20%), saturation (40%), hue diversity (40%)
    color_score = min(distinct_colors / 50, 1.0) * 20
    sat_score = min(saturation_ratio / 0.15, 1.0) * 40
    hue_score = min(active_hues / 4, 1.0) * 40
    colorful_score = color_score + sat_score + hue_score

    return {
        "total_sampled": total_sampled,
        "distinct_colors": distinct_colors,
        "saturation_ratio": round(saturation_ratio, 3),
        "brightness_ratio": round(brightness_ratio, 3),
        "active_hues": active_hues,
        "colorful_score": round(colorful_score, 1),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=9337)
    parser.add_argument("--navigate", "-n", required=True)
    parser.add_argument("--output", "-o", required=True)
    parser.add_argument("--click", "-c", default=None,
                        help="JS expression to execute (click, select, etc)")
    parser.add_argument("--click-retry", nargs="*", default=[],
                        help="Additional JS expressions to try if --colorful threshold not met")
    parser.add_argument("--wait", "-w", type=float, default=4.0)
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=720)
    parser.add_argument("--colorful", action="store_true",
                        help="Analyze colors and retry clicks if too dull")
    parser.add_argument("--threshold", type=float, default=30.0,
                        help="Minimum colorful_score (0-100) to accept screenshot")
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

    # Build list of click expressions to try
    click_expressions = []
    if args.click:
        click_expressions.append(args.click)
    click_expressions.extend(args.click_retry)

    best_img = None
    best_score = 0

    if not click_expressions:
        # No clicks - just screenshot
        img_data, msg_id = take_screenshot(ws, msg_id)
        if args.colorful:
            stats = analyze_png_colors(img_data)
            print(f"  Color analysis: score={stats.get('colorful_score', 0)}, "
                  f"saturation={stats.get('saturation_ratio', 0)}, "
                  f"hues={stats.get('active_hues', 0)}, "
                  f"distinct={stats.get('distinct_colors', 0)}")
        best_img = img_data
    else:
        for i, expr in enumerate(click_expressions):
            # Execute click
            _, msg_id = send_cmd(ws, msg_id, "Runtime.evaluate", {
                "expression": expr, "returnByValue": True
            })
            time.sleep(1.5)

            # Take screenshot
            img_data, msg_id = take_screenshot(ws, msg_id)

            if args.colorful:
                stats = analyze_png_colors(img_data)
                score = stats.get("colorful_score", 0)
                print(f"  Click {i+1}/{len(click_expressions)}: score={score:.1f}, "
                      f"sat={stats.get('saturation_ratio', 0)}, "
                      f"hues={stats.get('active_hues', 0)}")

                if score > best_score:
                    best_score = score
                    best_img = img_data

                if score >= args.threshold:
                    print(f"  Threshold {args.threshold} met!")
                    break
            else:
                best_img = img_data
                break  # No analysis, just use first click result

    if best_img is None:
        best_img, msg_id = take_screenshot(ws, msg_id)

    with open(args.output, "wb") as f:
        f.write(best_img)
    print(f"Screenshot: {args.output} ({len(best_img)} bytes, score={best_score:.1f})")

    # Reset viewport
    _, msg_id = send_cmd(ws, msg_id, "Emulation.clearDeviceMetricsOverride")
    ws.close()


if __name__ == "__main__":
    main()
