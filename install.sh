#!/usr/bin/env bash
# ==============================================================================
# Agent Guard — Universal One-Click MCP & Multi-App Installer
# Developer: Sarvesh (@anksarvesh-lgtm)
# https://github.com/anksarvesh-lgtm/agent-guard.git
# ==============================================================================
set -euo pipefail

echo "=========================================================="
echo "🛡️  Agent Guard — Universal MCP Installer"
echo "   Developed by Sarvesh (@anksarvesh-lgtm) | Apache-2.0"
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

# 2. Determine target repository directory
# If running via pipe or outside repo, use ~/.agent-guard
REPO_DIR=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [ -f "$SCRIPT_DIR/package.json" ] && grep -q '"name": "agent-guard"' "$SCRIPT_DIR/package.json" 2>/dev/null; then
        REPO_DIR="$SCRIPT_DIR"
    fi
fi

if [ -z "$REPO_DIR" ]; then
    TARGET_DIR="$HOME/.agent-guard"
    echo "• Installing Agent Guard to $TARGET_DIR..."
    if [ -d "$TARGET_DIR/.git" ]; then
        git -C "$TARGET_DIR" pull --ff-only origin main || true
    else
        rm -rf "$TARGET_DIR"
        git clone --depth 1 https://github.com/anksarvesh-lgtm/agent-guard.git "$TARGET_DIR"
    fi
    REPO_DIR="$TARGET_DIR"
fi

cd "$REPO_DIR"

# 3. Build if needed
if [ ! -f "dist/index.js" ] || [ ! -d "node_modules" ]; then
    echo "• Installing dependencies and compiling TypeScript..."
    "$NPM_BIN" install --silent
    "$NPM_BIN" run build --silent
fi

chmod +x dist/index.js dist/hook/stop-hook.js dist/hook/post-invocation-hook.js dist/cli.js 2>/dev/null || true

# 4. Handle update flag
if [ "${1:-}" = "--update" ] || [ "${1:-}" = "-u" ] || [ "${1:-}" = "update" ]; then
    echo "• Running Agent Guard auto-updater..."
    "$NODE_BIN" dist/cli.js update
    exit 0
fi

# 5. Run the universal installer CLI (auto-detects all installed coding apps by default)
"$NODE_BIN" dist/cli.js install "$@"
