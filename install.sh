#!/usr/bin/env bash
# ==============================================================================
# Agent Guard — Antigravity Automated Installer
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR"

echo "=========================================================="
echo "🛡️  Installing Agent Guard for Google Antigravity"
echo "=========================================================="

# 1. Resolve Node.js binary (minimum v20)
if [ -x "/Users/sarvesh/.local/node-v24/bin/node" ]; then
    NODE_BIN="/Users/sarvesh/.local/node-v24/bin/node"
    NPM_BIN="/Users/sarvesh/.local/node-v24/bin/npm"
elif command -v node >/dev/null 2>&1; then
    NODE_BIN="$(command -v node)"
    NPM_BIN="$(command -v npm)"
else
    echo "❌ Error: Node.js 20+ is required but not found on PATH." >&2
    exit 1
fi

NODE_VER="$("$NODE_BIN" -v)"
echo "• Using Node.js: $NODE_VER ($NODE_BIN)"

# 2. Build if needed
cd "$REPO_DIR"
if [ ! -f "dist/index.js" ] || [ ! -d "node_modules" ]; then
    echo "• Installing dependencies and compiling TypeScript..."
    "$NPM_BIN" install --silent
    "$NPM_BIN" run build --silent
fi

chmod +x dist/index.js dist/hook/stop-hook.js dist/cli.js 2>/dev/null || true

# 3. Check for update action
if [ "${1:-}" = "--update" ] || [ "${1:-}" = "-u" ] || [ "${1:-}" = "update" ]; then
    echo "• Running Agent Guard auto-updater..."
    "$NODE_BIN" dist/cli.js update
    exit 0
fi

# 4. Run the installer CLI
"$NODE_BIN" dist/cli.js install "$@"
