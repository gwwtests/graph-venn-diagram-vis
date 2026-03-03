# Chromium CDP Testing Container
# Runs headless Chromium with Chrome DevTools Protocol on configurable port
# Used by visualization agents for DOM testing and screenshot capture
#
# Build:  docker build -t gvdv-cdp-test docker/cdp-test/
# Run:    docker run -d --name gvdv-cdp-9222 -p 9222:9222 -v $(pwd)/dist:/srv/app gvdv-cdp-test
# Custom: docker run -d --name gvdv-cdp-9333 -p 9333:9222 -e CDP_PORT=9222 -v $(pwd)/dist:/srv/app gvdv-cdp-test

FROM node:22-slim

# Install Chromium and image processing tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    imagemagick \
    curl \
    socat \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /srv/app

# Default CDP port inside container (map to host port via -p)
ENV CDP_PORT=9222
ENV HTTP_PORT=8080

# Entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Screenshot helper
COPY screenshot.sh /usr/local/bin/screenshot.sh
RUN chmod +x /usr/local/bin/screenshot.sh

# 9223 = CDP (socat proxy), 8080 = HTTP server
EXPOSE 9223 8080

ENTRYPOINT ["/entrypoint.sh"]
