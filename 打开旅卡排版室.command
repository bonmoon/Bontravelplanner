#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="8787"
cd "$PROJECT_DIR"

if [ ! -f "dist/index.html" ]; then
  npm install
  npm run build
fi

open "http://127.0.0.1:${PORT}"
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory dist
