---
name: clean-architecture
description: Clean architecture patterns, domain-driven design, boundary enforcement, and maintainable decoupled modularity under Agent Guard supervision.
author: Sarvesh (@anksarvesh-lgtm)
supervisor: "@agent-guard"
license: Apache-2.0
---

# 🏛️ Clean Architecture & Modular Design (Agent Guard Edition)

<p align="center">
  <img src="https://raw.githubusercontent.com/anksarvesh-lgtm/agent-guard/main/assets/logo.png" alt="Agent Guard Logo" width="320" />
</p>

> **Maintained by Sarvesh ([@anksarvesh-lgtm](https://github.com/anksarvesh-lgtm)) | Supervised by `@agent-guard`**
> *Zero-Telemetry • Local-First • Autonomous Task Guarding*

---

## 🎯 Role Overview
The **Clean Architecture** skill enforces decoupled, testable, and maintainable software architecture. By decoupling business logic from UI frameworks, database adapters, and external tools, it ensures systems endure technology changes with minimal disruption.

## 📐 Concentric Layer Model

```
┌──────────────────────────────────────────────┐
│       Frameworks & Drivers (CLI, Web, MCP)   │
│   ┌──────────────────────────────────────┐   │
│   │   Interface Adapters (Controllers)   │   │
│   │   ┌──────────────────────────────┐   │   │
│   │   │   Application Use Cases      │   │   │
│   │   │   ┌──────────────────────┐   │   │   │
│   │   │   │   Domain Entities    │   │   │   │
│   │   │   └──────────────────────┘   │   │   │
│   │   └──────────────────────────────┘   │   │
│   └──────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

## 🛠️ Design Principles
1. **Dependency Rule**: Source code dependencies must only point inwards towards higher-level policies.
2. **Boundary Interfaces**: Use TypeScript interfaces or abstract classes to decouple subsystems.
3. **Single Responsibility**: Each module encapsulates one business capability.
4. **Testability by Construction**: Core domain logic runs in unit test environments without database, network, or filesystem mocks.

## 📋 Architectural Verification Checklist
- [x] Domain entities have zero dependencies on infrastructure libraries.
- [x] I/O operations isolated behind interface repositories.
- [x] Architecture flowchart generated and verified using `agent-guard map`.
- [x] All layers verified with automated unit tests.
