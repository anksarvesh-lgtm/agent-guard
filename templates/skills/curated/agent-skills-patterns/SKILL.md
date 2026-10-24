---
name: agent-skills-patterns
description: Master Agent Skills architecture, progressive disclosure patterns, directory conventions (.agents/skills/), YAML frontmatter specification, and multi-agent host compatibility under Agent Guard supervision.
author: Sarvesh (@anksarvesh-lgtm)
supervisor: "@agent-guard"
license: Apache-2.0
---

# 📐 Agent Skills Design Patterns & Specification

<p align="center">
  <img src="https://raw.githubusercontent.com/anksarvesh-lgtm/agent-guard/main/assets/logo.png" alt="Agent Guard Logo" width="320" />
</p>

> **Maintained by Sarvesh ([@anksarvesh-lgtm](https://github.com/anksarvesh-lgtm)) | Supervised by `@agent-guard`**
> *Agent Skills Architecture & Standards • Zero-Telemetry • Local-First*

---

## 🎯 Role Overview
The **Agent Skills Patterns** skill encapsulates the universal Agent Skills specification and progressive disclosure architecture adopted by Google Antigravity, Claude Code, Cursor, Codex, and Gemini CLI.

## 🏗️ 5 Core Design Patterns

### 1. Progressive Disclosure Pattern
- **Phase 1: Discovery** — Agent inspects only `name` and `description` from index (0 tokens prompt bloat).
- **Phase 2: JIT Activation** — When a user request matches semantic query, agent loads full `SKILL.md` runbook on-demand.
- **Phase 3: Execution** — Specialized auxiliary scripts (`scripts/`) and references (`references/`) are invoked only if needed.

### 2. Guarded Workflow Pattern
- Enforces pre-conditions, checklists, and deterministic validation rules before executing mutations.

### 3. Context Budget Discipline
- Keep `SKILL.md` concise (< 500 lines, < 5,000 tokens). Move bulky reference manuals to `references/`.

### 4. Hermetic Directory Convention
```text
<project>/.agents/skills/<skill-name>/
├── SKILL.md          # Mandatory runbook & frontmatter
├── scripts/          # Optional deterministic helper scripts
├── references/       # Optional deep-dive docs
└── assets/           # Optional templates & schemas
```

### 5. Multi-Host Interoperability
- Project-level `.agents/skills/` automatically overrides user-level `~/.gemini/config/skills/` or `~/.agents/skills/`.
