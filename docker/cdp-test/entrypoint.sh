#!/bin/bash
set -e

# Chromium always binds CDP to 127.0.0.1:9222 internally
# socat exposes it on 0.0.0.0:9223 for external access
# Docker -p maps host port to container 9223

INTERNAL_CDP=9222
EXTERNAL_CDP=9223

# Start simple HTTP server for the app files
cd /srv/app
npx -y serve -l ${HTTP_PORT} -s --no-clipboard &

# Wait for HTTP server to be ready
for i in $(seq 1 10); do
  curl -s http://localhost:${HTTP_PORT}/ > /dev/null 2>&1 && break
  sleep 0.5
done

# Start Chromium in headless mode with CDP
chromium \
  --headless=new \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --disable-software-rasterizer \
  --remote-debugging-port=${INTERNAL_CDP} \
  --window-size=1024,768 \
  --hide-scrollbars \
  --force-device-scale-factor=1 \
  http://localhost:${HTTP_PORT}/ &

# Wait for Chromium CDP to be ready
for i in $(seq 1 30); do
  curl -s http://127.0.0.1:${INTERNAL_CDP}/json/version > /dev/null 2>&1 && break
  sleep 0.5
done

echo "CDP ready, proxying 0.0.0.0:${EXTERNAL_CDP} -> 127.0.0.1:${INTERNAL_CDP}"
exec socat TCP-LISTEN:${EXTERNAL_CDP},fork,reuseaddr,bind=0.0.0.0 TCP:127.0.0.1:${INTERNAL_CDP}
