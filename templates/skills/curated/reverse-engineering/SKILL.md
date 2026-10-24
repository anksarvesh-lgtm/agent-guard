---
name: reverse-engineering
description: Reverse engineer compiled binaries, JavaScript AST packages, protocol captures, and application graphs using REA and Agent Guard supervision.
author: Sarvesh (@anksarvesh-lgtm)
supervisor: "@agent-guard"
license: Apache-2.0
---

# 🔍 Reverse Engineering & Architecture Reconstruction (Agent Guard Edition)

<p align="center">
  <img src="https://raw.githubusercontent.com/anksarvesh-lgtm/agent-guard/main/assets/logo.png" alt="Agent Guard Logo" width="320" />
</p>

> **Maintained by Sarvesh ([@anksarvesh-lgtm](https://github.com/anksarvesh-lgtm)) | Supervised by `@agent-guard`**
> *Zero-Telemetry • Local-First • Autonomous Task Guarding*

---

## 🎯 Role Overview
The **Reverse Engineering** skill guides static and dynamic analysis of opaque binaries, Electron/ASAR bundles, minified JavaScript packages, and network protocols using REA (`reverse-engineer-anything`) and specialized tooling.

## 🛠️ REA Integration
When analyzing targets with REA:
1. **JavaScript/ASAR Trees**: Execute `rea:analyze_javascript_application` to reconstruct AST graphs, entrypoints, IPC handlers, and call flows without runtime execution.
2. **Native & Mach-O/ELF Binaries**: Utilize `open_binary`, `inspect_artifact`, and disassembly providers (Hopper, Ghidra, Rizin) to recover symbol tables, CFGs, and strings.
3. **Evidence Ledgers**: Store reconstructed findings into `.agent/evidence/` with verifiable checksums and confidence scores.

## 📋 Reverse Engineering Verification Checklist
- [x] Target artifact hashed (SHA-256) and recorded.
- [x] Static AST/CFG recovered using REA providers.
- [x] Findings documented in structured analysis brief.
