# Agent Guard — Installation & Coding App Setup Guide

> **Developer**: [Sarvesh](https://github.com/anksarvesh-lgtm)  
> **Repository**: [https://github.com/anksarvesh-lgtm/agent-guard.git](https://github.com/anksarvesh-lgtm/agent-guard.git)

This guide covers complete installation instructions and configuration snippets for **Agent Guard** (`agent-guard`) across all major AI coding apps, IDEs, and CLI tools.

---

## 📋 Prerequisites

Before installing, ensure your environment meets these requirements:
* **Node.js**: `v20.0.0` or newer (`node -v`)
* **Git**: Installed and available on system PATH (`git --version`)
* **Operating System**: macOS (Apple Silicon / Intel), Windows 10/11, or Linux

---

## ⚡ 1-Click Universal Git Install

To clone and install Agent Guard with a single command from any terminal:

```bash
git clone https://github.com/anksarvesh-lgtm/agent-guard.git ~/.agent-guard && ~/.agent-guard/install.sh
```

If you already cloned the repository locally:
```bash
cd agent-guard
./install.sh
```

---

## 🛠️ Configuring AI Coding Apps

Agent Guard connects over the standardized **Model Context Protocol (MCP)** using `stdio`. Below is the exact configuration for each coding application:

### 1. Google Antigravity (IDE, App 2.0, CLI `agy`)

The automated installer configures Antigravity automatically. To configure manually, add to `~/.gemini/config/mcp_config.json`:

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

#### Antigravity Stop Hook (`.agents/hooks.json` in your workspace)
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

---

### 2. Claude Code CLI

You can add Agent Guard to Claude Code with a single CLI command:

```bash
claude mcp add agent-guard -- node /absolute/path/to/agent-guard/dist/index.js
```

Or add it directly to `~/.claude/mcp.json`:

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

---

### 3. Cursor IDE

In Cursor, go to **Settings &rarr; Features &rarr; MCP &rarr; Add New MCP Server**, or edit `~/.cursor/mcp.json`:

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

---

### 4. Windsurf (Codeium / Cascade)

Add to `~/.codeium/windsurf/mcp_config.json`:

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

---

### 5. VS Code (Cline / Roo Code / Continue)

For **Cline** (`~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` on macOS or `%APPDATA%\Code\User\...` on Windows):

```json
{
  "mcpServers": {
    "agent-guard": {
      "command": "node",
      "args": ["/absolute/path/to/agent-guard/dist/index.js"],
      "disabled": false,
      "autoApprove": [
        "task_start",
        "task_checkpoint",
        "task_status",
        "repo_brief",
        "keep_awake"
      ]
    }
  }
}
```

---

### 6. Zed Editor

Add to `~/.config/zed/settings.json`:

```json
{
  "experimental": {
    "model_context_protocol": {
      "servers": {
        "agent-guard": {
          "command": "node",
          "args": ["/absolute/path/to/agent-guard/dist/index.js"]
        }
      }
    }
  }
}
```

---

## 🎯 Target Project Setup (Rules & Hooks)

To ensure the AI agent in any coding app knows when to invoke `task_start`, `task_checkpoint`, and `repo_brief`:

1. Run the target-workspace command:
   ```bash
   ./install.sh --workspace "/path/to/your/project"
   ```
2. This installs:
   * **`.agents/hooks.json`**: Prevents premature stopping.
   * **`AGENTS.md`**: Injects rules instructing the agent to call `task_status` first, verify completions with >= 10-char proof notes, and retry failed steps before moving on.

---

## 🤖 Mentioning `@agent-guard` in Antigravity Chat

Running `./install.sh` or `npm run install:antigravity` automatically bundles Agent Guard as an official Antigravity plugin and persona. You can summon it anytime in your prompt:

```text
@agent-guard migrate database models and verify migrations pass cleanly
```

This ensures:
* The supervisor initializes `.agent/ledger.json` before multi-step code generation begins.
* Sleep inhibition is held active during long commands.
* The Stop hook prevents premature exits before all tests pass.

---

## 🔄 Auto-Update & Maintenance

Agent Guard supports automated GitHub releases and zero-hassle local updating:

```bash
# Update local repository from origin main and rebuild:
npm run update

# Or via install script:
./install.sh --update
```

When running in the background, Agent Guard periodically audits `origin/main` (throttled to at most once per hour) and signals available updates cleanly without interrupting active workflows.

---

## 🩺 Verification & Diagnostics

To verify your installation and environment health at any time:

```bash
npm run doctor
```

**Diagnostic Output:**
```
🩺 Agent Guard Readiness Doctor

• Node version:    v24.22.0 (/Users/sarvesh/.local/node-v24/bin/node)
• MCP Config:      [OK] agent-guard is registered in mcp_config.json
• Mention @agent-guard: [OK] Plugin active in Antigravity
• Auto-Update:     [OK] Up to date with origin/main
• Server Binary:   [OK] dist/index.js
• Hook Binary:     [OK] dist/hook/stop-hook.js
• Sleep Inhibitor: [OK] macOS caffeinate available
```

Run automated tests (44/44 tests):
```bash
npm test
```

---

## 🗑️ How to Uninstall

Agent Guard never alters system power settings or leaves daemons behind. To remove:

1. Remove the `"agent-guard"` entry from your coding app's MCP config file.
2. Remove `~/.gemini/config/plugins/agent-guard/` if installed as an Antigravity plugin.
3. Remove `.agents/hooks.json` from your workspace.
4. Remove `.agent/` folders if you wish to clear task history.
