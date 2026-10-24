---
name: ai-agents-architect
description: Master autonomous agent system architecture, multi-agent orchestration, tool routing, and failure-tolerant execution under Agent Guard supervision.
author: Sarvesh (@anksarvesh-lgtm)
supervisor: "@agent-guard"
license: Apache-2.0
---

# 🤖 AI Agents Architect (Agent Guard Edition)

<p align="center">
  <img src="https://raw.githubusercontent.com/anksarvesh-lgtm/agent-guard/main/assets/logo.png" alt="Agent Guard Logo" width="320" />
</p>

> **Maintained by Sarvesh ([@anksarvesh-lgtm](https://github.com/anksarvesh-lgtm)) | Supervised by `@agent-guard`**
> *Zero-Telemetry • Local-First • Autonomous Task Guarding*

---

## 🎯 Role Overview
The **AI Agents Architect** skill equips agents with enterprise-grade patterns for designing, orchestrating, and supervising autonomous multi-agent coding workflows. Aligned directly with **Agent Guard** supervision, it guarantees deterministic task execution, ledger tracking, and graceful degradation.

## 🛡️ Agent Guard Integration
When running under `@agent-guard`:
1. **Ledger Alignment**: Every multi-agent plan decomposes into atomic steps recorded in `.agent/ledger.json`.
2. **Supervisor Interception**: Agents communicate progress via `task_checkpoint`. If an agent halts prematurely, `@agent-guard` intercepts exit signals and orders continuation until all steps finish.
3. **Lease Protection**: Long-running background agent processes acquire keep-awake leases via `keep_awake` to prevent sleep disruptions.

## 🏗️ Core Architecture Patterns

### 1. Guarded ReAct Loop
```
[Think / Plan] ➡️ [Invoke Tool] ➡️ [Verify Observation] ➡️ [Atomic Checkpoint]
      ▲                                                           │
      └────────────────── Iteration Limit Check ──────────────────┘
```

### 2. Multi-Agent Delegation
- **Planner Agent**: Synthesizes repo brief and decomposes requirements into 3-12 verifiable steps.
- **Worker / Subagents**: Focus exclusively on designated step scopes.
- **Supervisor (@agent-guard)**: Verifies step proofs, persists state, enforces execution, and broadcasts directives.

### 3. Fail-Safe Degradation
- Set strict retry limits (default 3 tries).
- On recurring error: record exact stack trace, mark step blocked with reason, and pivot to unblocked parallel work.
- Never loop infinitely without supervisor awareness.

## 📋 Best Practices Checklist
- [x] Always verify repository state using `repo_brief` before starting.
- [x] Run unit tests before emitting `task_checkpoint`.
- [x] Commit to git after every completed step.
