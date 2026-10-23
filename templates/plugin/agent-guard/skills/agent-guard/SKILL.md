---
name: agent-guard
description: >-
  Supervise and track multi-step development tasks, prevent computer sleep with native keep-awake leases, and enforce atomic ledger checkpoints. Mention @agent-guard whenever starting complex tasks.
---

# Agent Guard Skill (@agent-guard)

Use this skill whenever the user mentions `@agent-guard` or asks to run autonomous, multi-step development tasks safely.

## Core Capabilities
- **Task Tracking**: Strict DAG-based step execution tracked in `.agent/ledger.json`.
- **Anti-Abandonment**: Workspace Stop hook blocks premature exits until all steps are done.
- **Sleep Prevention**: OS-native keep-awake lease holds display and CPU awake up to 8 hours.
- **Token Economy**: Lean MCP responses (<60 tokens on checkpoints, <150 on starts, <500 on status).

## Workflow Execution Steps
1. **Status Inspection**: Call `task_status`. If a task is active, resume the current step.
2. **Context Intake**: If starting new work, call `repo_brief` to get the project brief.
3. **Task Definition**: Call `task_start` with the goal and 3-12 discrete steps with dependencies.
4. **Execution & Proof**: After completing each step, run tests/validations and call `task_checkpoint` with proof.
5. **Git Commit**: Commit finished changes to git after each completed step.
