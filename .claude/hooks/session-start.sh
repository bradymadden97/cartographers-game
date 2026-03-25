#!/bin/bash
set -euo pipefail

# Only run in Claude Code remote/cloud sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

echo "Installing dependencies..."
npm install

# Wrangler requires the dist/ assets directory to exist at startup
mkdir -p "$CLAUDE_PROJECT_DIR/dist"

echo "Starting Cloudflare Worker dev server on port 8787..."
npm run dev:worker > /tmp/worker.log 2>&1 &

echo "Starting Vite dev server on port 5173..."
npm run dev > /tmp/vite.log 2>&1 &

echo ""
echo "Dev servers started!"
echo "  UI preview (hot reload): port 5173"
echo "  Worker:                  port 8787"
echo ""
echo "To open the preview: look for the port/preview icon in the Claude Code"
echo "cloud UI (claude.ai) and open port 5173. The URL works from any device."
echo ""
echo "Edit any file in src/ and the browser will update instantly (Vite HMR)."
echo "Logs: /tmp/vite.log | /tmp/worker.log"
