---
name: test-driven-development
description: Test-Driven Development (TDD), high-coverage unit and integration test suites, and regression prevention under Agent Guard supervision.
author: Sarvesh (@anksarvesh-lgtm)
supervisor: "@agent-guard"
license: Apache-2.0
---

# 🧪 Test-Driven Development (Agent Guard Edition)

<p align="center">
  <img src="https://raw.githubusercontent.com/anksarvesh-lgtm/agent-guard/main/assets/logo.png" alt="Agent Guard Logo" width="320" />
</p>

> **Maintained by Sarvesh ([@anksarvesh-lgtm](https://github.com/anksarvesh-lgtm)) | Supervised by `@agent-guard`**
> *Zero-Telemetry • Local-First • Autonomous Task Guarding*

---

## 🎯 Role Overview
The **Test-Driven Development (TDD)** skill ensures software reliability through the disciplined cadence of Red-Green-Refactor. Combined with Agent Guard's atomic step checkpoints, it guarantees that every code modification is accompanied by reproducible test proof.

## 🔄 The TDD Red-Green-Refactor Cycle

1. **🔴 Red**: Write a minimal failing test defining the desired behavior. Run the test and confirm it fails for the expected reason.
2. **🟢 Green**: Implement the simplest production code that satisfies the test. Verify the test suite passes.
3. **🔵 Refactor**: Clean up implementation, eliminate duplication, and improve readability while keeping tests passing.
4. **🛡️ Guard Checkpoint**: Call `task_checkpoint` with exact test suite counts as verifiable proof.

## 📊 Test Pyramid Strategy
- **Unit Tests (70%)**: Fast, deterministic, in-memory tests exercising isolated functions and classes.
- **Integration Tests (20%)**: Test interactions between subsystems (e.g. MCP handlers, CLI commands, filesystem ledgers).
- **End-to-End Tests (10%)**: Exercise full agent loops, hook executions, and process lifecycles.

## 📋 TDD Verification Checklist
- [x] Failing test written before new production code.
- [x] All test suites pass (0 failing tests).
- [x] Test counts and proofs recorded in Agent Guard step checkpoint.
