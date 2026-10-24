# 🛡️ Agent Guard — Universal Installation & Agent Setup

<p align="center">
  <img src="assets/logo.png" alt="Agent Guard Logo" width="380" />
</p>

<p align="center">
  <strong>One Terminal Command & One Agent Prompt Setup for Any AI Coding Application</strong><br>
  <em>Antigravity • Claude Code • Cursor • Codex CLI • Gemini CLI • Windsurf • Cline / Roo Code • Zed</em><br>
  <em>Developed by <strong>Sarvesh</strong> (<a href="https://github.com/anksarvesh-lgtm">@anksarvesh-lgtm</a>) • Apache-2.0 License</em>
</p>

---

## ⚡ Option 1: One-Line Terminal Command (Recommended)

Run this single command in your terminal to automatically detect all installed AI coding apps on your machine and configure Agent Guard into every one of them:

```bash
curl -fsSL https://raw.githubusercontent.com/anksarvesh-lgtm/agent-guard/main/install.sh | bash
```

### Or with NPX:
```bash
npx -y agent-guard install
```

### Install to All Supported Apps Explicitly:
```bash
curl -fsSL https://raw.githubusercontent.com/anksarvesh-lgtm/agent-guard/main/install.sh | bash -s -- --all
```

---

## 🤖 Option 2: The Universal Agent Prompt (Copy & Paste to Any AI Agent)

Copy and paste the exact prompt below into **Claude Code**, **Cursor**, **Google Antigravity**, **Codex**, or **Gemini CLI**:

```text
Please install and activate the Agent Guard MCP supervisor (https://github.com/anksarvesh-lgtm/agent-guard.git) in this workspace.

Execute this one-line command in the terminal:
curl -fsSL https://raw.githubusercontent.com/anksarvesh-lgtm/agent-guard/main/install.sh | bash

After installation:
1. Verify with: node ~/.agent-guard/dist/cli.js doctor
2. Ensure .agents/hooks.json and AGENTS.md exist in this workspace.
3. Adopt the @agent-guard autonomous pair-programming rules:
   - Call task_status to resume or repo_brief to initialize tasks.
   - Decompose all multi-step goals into 3 to 12 verifiable steps.
   - Call task_checkpoint with test proofs after every completed step.
   - Keep OS awake via keep_awake during builds and long commands.
Report back once Agent Guard is active and ready to supervise.
```

---

## 📱 App-Specific Quick Instructions

### 1. Google Antigravity & Gemini CLI
- **MCP Config**: `~/.gemini/config/mcp_config.json`
- **Plugin Mention**: `@agent-guard` active in `~/.gemini/config/plugins/agent-guard/`
- **Auto-Accept**: Registered in `~/.gemini/config/config.json`
- **Command**:
  ```bash
  npx agent-guard install --antigravity
  ```

### 2. Claude Code
- **Global Config**: `~/.claude.json` / `~/.claude/mcp.json`
- **Command**:
  ```bash
  claude mcp add agent-guard -- node ~/.agent-guard/dist/index.js
  # Or via agent-guard installer:
  npx agent-guard install --claude
  ```

### 3. Cursor IDE
- **Config**: `~/.cursor/mcp.json`
- **Command**:
  ```bash
  npx agent-guard install --cursor
  ```

### 4. Codex CLI
- **Config**: `$CODEX_HOME/mcp.json` or `~/.codex/mcp.json`
- **Command**:
  ```bash
  npx agent-guard install --codex
  ```

### 5. Windsurf (Codeium / Cascade)
- **Config**: `~/.codeium/windsurf/mcp_config.json`
- **Command**:
  ```bash
  npx agent-guard install --windsurf
  ```

### 6. VS Code (Cline / Roo Code)
- **Config**: `cline_mcp_settings.json`
- **Command**:
  ```bash
  npx agent-guard install --cline
  ```

### 7. Zed Editor
- **Config**: `~/.config/zed/settings.json`
- **Command**:
  ```bash
  npx agent-guard install --zed
  ```

---

## 🛠️ Verification & Doctor

Confirm everything is configured correctly:

```bash
# In local clone:
npm run doctor

# Or standalone:
node ~/.agent-guard/dist/cli.js doctor
```

Output:
```
🩺 Agent Guard Readiness Doctor

• Node version:    v24.22.0 (/Users/sarvesh/.local/node-v24/bin/node)
• MCP Config:      [OK] agent-guard is registered in mcp_config.json
• Mention @agent-guard: [OK] Plugin active in Antigravity
• Auto-Accept IDE: [OK] Tool and command permissions granted
• Auto-Update:     [OK] Up to date with origin/main
• Server Binary:   [OK] dist/index.js
• Stop Hook:       [OK] dist/hook/stop-hook.js
• Enforce Hook:    [OK] dist/hook/post-invocation-hook.js
• Sleep Inhibitor: [OK] macOS caffeinate available
```

---

## 📄 License & Maintainer

- **Developer**: **Sarvesh** ([@anksarvesh-lgtm](https://github.com/anksarvesh-lgtm))
- **Repository**: [https://github.com/anksarvesh-lgtm/agent-guard.git](https://github.com/anksarvesh-lgtm/agent-guard.git)
- **License**: Apache-2.0
