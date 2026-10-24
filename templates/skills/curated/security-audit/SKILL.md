---
name: security-audit
description: Enterprise zero-trust security audit, secret leakage prevention, vulnerability detection, and OWASP compliance under Agent Guard supervision.
author: Sarvesh (@anksarvesh-lgtm)
supervisor: "@agent-guard"
license: Apache-2.0
---

# 🛡️ Security Audit & Hardening (Agent Guard Edition)

<p align="center">
  <img src="https://raw.githubusercontent.com/anksarvesh-lgtm/agent-guard/main/assets/logo.png" alt="Agent Guard Logo" width="320" />
</p>

> **Maintained by Sarvesh ([@anksarvesh-lgtm](https://github.com/anksarvesh-lgtm)) | Supervised by `@agent-guard`**
> *Zero-Telemetry • Local-First • Autonomous Task Guarding*

---

## 🎯 Role Overview
The **Security Audit** skill enforces rigorous defense-in-depth security principles across source repositories, dependencies, configuration files, and runtime environments.

## 🔒 Agent Guard Security Directives
1. **Never Print Secrets**: Passwords, API tokens, `.env` values, and private SSH keys must never be logged or committed.
2. **Local-First Boundary**: Agent Guard enforces zero external telemetry. All audit artifacts stay strictly local inside the workspace `.agent/` directory.
3. **Execution Guardrails**: Destructive commands (e.g. `rm -rf /`, `curl | sh`, unsanitized shell execution) are flagged immediately.

## 🔍 Core Security Pillars

### 1. Secret Scanning
- Regex scanning for AWS credentials, GitHub PATs, JWT tokens, private keys.
- Verification that `.env`, `.env.local`, and sensitive credentials are in `.gitignore`.

### 2. Dependency Vulnerability Analysis
- Audit third-party packages for CVEs (`npm audit`, pip-audit, cargo audit).
- Pin dependencies to immutable digests or exact patch versions.
- Flag abandoned or untrusted third-party MCP servers.

### 3. Code Hardening
- Prevent command injection (avoid `exec()` with unsanitized user inputs; use parameterized arrays).
- Validate all incoming API inputs using strict schemas (e.g. `zod`).
- Enforce strict CORS policies and Content Security Policy headers.

## 📋 Security Verification Checklist
- [x] Workspace secrets excluded from git history.
- [x] Input boundaries validated with Zod/TypeBox schemas.
- [x] Shell commands parameterized without shell evaluation.
- [x] Checkpoint audit findings to Agent Guard task ledger.
