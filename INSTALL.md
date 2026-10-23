# Agent Guard — Installation & Setup Guide

This guide covers all methods to install, configure, verify, and uninstall **Agent Guard** (`agent-guard`) with Google Antigravity and compatible Model Context Protocol (MCP) clients.

---

## Prerequisites

Before installing Agent Guard, ensure your system meets the following requirements:

1. **Node.js**: Version **20.0.0** or newer (`node -v`).
2. **Git**: Installed and available on your system PATH (`git --version`).
3. **Google Antigravity**: Antigravity IDE, Antigravity 2.0, or the `agy` CLI installed.
4. **Operating System**: macOS (Apple Silicon / Intel), Windows 10/11, or Linux (systemd-supported).

---

## Installation Methods

### Method 1: The Automated 1-Click Installer (Recommended)

From within the `agent-guard` repository folder:

```bash
./install.sh
```

**What this automated command does:**
1. Resolves and validates your active Node.js binary (Node 20+).
2. Automatically installs dependencies and compiles TypeScript (`npm install && npm run build`).
3. Registers the `agent-guard` server entry into your global Antigravity config (`~/.gemini/config/mcp_config.json`), non-destructively preserving existing servers.
4. Sets up the Stop hook in `.agents/hooks.json` in your workspace.
5. Deploys the recommended workspace rules into `AGENTS.md`.

---

### Method 2: Node.js / NPM CLI Installer

If you prefer using `npm` directly:

```bash
cd agent-guard
npm install
npm run build
npm run install:antigravity
```

---

### Method 3: Remote 1-Line Git Install (Fresh Machine)

To clone and install Agent Guard in a single terminal command from anywhere:

```bash
git clone https://github.com/<your-username>/agent-guard.git ~/.agent-guard && ~/.agent-guard/install.sh
```

---

### Method 4: Configuring a Specific Workspace / Project

To install Agent Guard's Stop hook and `AGENTS.md` rules into any other existing repository or workspace on your machine:

```bash
./install.sh --workspace "/path/to/your/project"
```

Or via the TypeScript CLI:

```bash
node dist/cli.js install --workspace "/path/to/your/project"
```

To preview changes without writing files, append `--dry-run`:

```bash
./install.sh --workspace "/path/to/your/project" --dry-run
```

---

### Method 5: Manual Configuration

If you prefer to configure your environment by hand without running the script:

#### 1. Build the Binaries
```bash
cd agent-guard
npm install
npm run build
```

#### 2. Register MCP Server
Open `~/.gemini/config/mcp_config.json` (or create it if absent) and add the `agent-guard` entry under `mcpServers`:

```json
{
  "mcpServers": {
    "agent-guard": {
      "command": "node",
      "args": ["/absolute/path/to/agent-guard/dist/index.js"]
    }
  }
}
```
*(Tip: Replace `"node"` with the absolute path to your Node 20+ binary, e.g., `$(which node)`).*

#### 3. Register the Stop Hook
In the root of your target project, create or edit `.agents/hooks.json`:

```json
{
  "agent-guard-stop": {
    "Stop": [
      {
        "type": "command",
        "command": "node /absolute/path/to/agent-guard/dist/hook/stop-hook.js"
      }
    ]
  }
}
```

#### 4. Install Agent Rules
Copy [`templates/AGENT_RULES.md`](templates/AGENT_RULES.md) into your project root as `AGENTS.md`.

---

## Verifying Your Installation

### 1. Run the Built-in Doctor Check
Agent Guard includes a diagnostic utility that audits your Node binary, build files, MCP config, and sleep inhibitor:

```bash
npm run doctor
```

**Expected output:**
```
🩺 Agent Guard Readiness Doctor

• Node version:    v24.22.0 (/path/to/node)
• MCP Config:      [OK] agent-guard is registered in mcp_config.json
• Server Binary:   [OK] dist/index.js
• Hook Binary:     [OK] dist/hook/stop-hook.js
• Sleep Inhibitor: [OK] macOS caffeinate available
```

### 2. Run the Full Test Suite
Ensure all 40 unit and integration tests pass:

```bash
npm test
```

### 3. Reload Antigravity
After registering the MCP server, restart or reload your Antigravity window so the 5 new tools are loaded into the agent's context.

---

## How to Uninstall

If you ever wish to remove Agent Guard completely, it leaves zero system settings altered:

1. **Remove MCP Registration**: Delete the `"agent-guard"` entry from `~/.gemini/config/mcp_config.json`.
2. **Remove Project Hooks**: Remove `"agent-guard-stop"` from `.agents/hooks.json` in your projects.
3. **Remove Project Rules**: Remove the rules from `AGENTS.md`.
4. **Remove State Files**: Delete the `.agent/` directory inside your projects.
5. **Delete Repository**: Delete the `agent-guard` folder.

Agent Guard never modifies permanent OS power configurations; normal sleep timers remain untouched.
