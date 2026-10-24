# Changelog

All notable changes to **Agent Guard** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] - 2026-10-24

### Added
- **Real-Time Antigravity Language Server Quota Probe (`src/tokens/liveQuota.ts`)**:
  - Auto-discovers running local Antigravity Language Server process, HTTPS port, and CSRF token.
  - Queries Connect Protocol RPC endpoints `RetrieveUserQuotaSummary` and `GetUserStatus`.
  - Reports live ground-truth Gemini 5h/weekly quotas, Claude/GPT 5h/weekly quotas, and reset countdowns.
  - Exposes prompt and flow credit balances and active user account tier.
- **Multi-Layer Antigravity Account Switcher (`src/accounts/`)**:
  - Atomic swap of `~/.gemini/jetski-standalone-oauth-token` with strict 0600 permissions.
  - SQLite database state synchronization with `state.vscdb` (`antigravityUnifiedStateSync.oauthToken` and `antigravityUnifiedStateSync.userStatus`).
  - Automatic 1% quota tripwire auto-rotator preventing workflow disruptions.
  - 1-click active session snapshotting and raw token file import.
- **Universal IDE Extension & In-App Webview Dashboard (`src/extension/`)**:
  - Zero-dependency universal extension running inside Google Antigravity IDE, Cursor, Windsurf, and VS Code.
  - Interactive Webview Dashboard with Overview, Account Switcher, Token Quota, Sleep & Turbo, and Skills tabs.
  - 1-click "Check for Updates" and "Update Agent Guard" with automatic rebuild and window reload.
  - Status Bar item with live quota percentage, active account badge, and sleep prevention status.
- **Expanded Test Suite (`test/`)**:
  - 111 automated unit and integration tests across 15 Vitest test suites passing 100%.

---

## [0.1.0] - 2026-10-23

### Added
- **MCP Server Implementation (`src/index.ts`)**:
  - Registered 5 focused tools over `stdio`: `task_start`, `task_checkpoint`, `task_status`, `keep_awake`, and `repo_brief`.
- **Atomic State Ledger Engine (`src/ledger.ts`)**:
  - File locking (`.agent/ledger.lock`) with 30s stale lock eviction.
  - Safe writes with atomic temp file renaming and automatic recovery from `ledger.prev.json`.
  - Task archiving to `.agent/history/<task_id>.json` on task replacement.
- **Retry & Step State Machine**:
  - Minimum 10-character proof enforcement (`NEED_PROOF`) for completed steps.
  - Retry counter escalation up to `max_tries` (default 3) before transitioning to `blocked`.
  - Automatic dependency cascade blocking down the step DAG.
  - Deterministic step priority: `in_progress` &rarr; `failed` with retries &rarr; first ready `pending`.
- **Guarded OS Keep-Awake Supervisor (`src/awake/`)**:
  - macOS `caffeinate -di -t <sec> -w <pid>` with seamless child swapping (no sleep gap).
  - Battery discharge detection via `pmset -g batt` with advisory warnings.
  - Cross-platform support for Windows (`SetThreadExecutionState`) and Linux (`systemd-inhibit`).
  - Auto-expiring lease renewed at every checkpoint with an 8-hour safety ceiling.
- **Token-Efficient Repository Brief Generator (`src/brief/`)**:
  - Compact summary generator under 1,500 tokens (hard cap at 8,000 characters).
  - Freshness checking via `git rev-parse HEAD` and file list hashing.
  - Secret filtering excluding `.env*`, `*.pem`, `*.key`, `id_rsa`, and build output directories.
- **Antigravity Stop Hook (`src/hook/stop-hook.ts`)**:
  - Intercepts premature stops when unblocked steps remain.
  - Loop breaker: allows exit after 3 consecutive idle pushes or 10 total pushes.
  - Complete crash isolation: fails open to ensure IDE never locks up.
- **Automated CLI & Installer (`src/cli.ts` & `install.sh`)**:
  - 1-click automated setup for Antigravity (`~/.gemini/config/mcp_config.json`, `.agents/hooks.json`, and `AGENTS.md`).
  - Diagnostic readiness doctor (`npm run doctor`).
- **Comprehensive Test Suite (`test/`)**:
  - 40 automated unit tests passing across all components with Vitest.
- **License & Community Assets**:
  - Apache License 2.0.
  - Full brand logos (`assets/logo.png`, `assets/icon.png`, `assets/logo.svg`).
  - GitHub CI workflows, issue templates, PR template, contributing guidelines, and security policy.
