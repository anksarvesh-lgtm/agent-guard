---
name: performance-profiling
description: Runtime profiling, Node.js/V8 heap analysis, event-loop latency tracking, and hot-path bottleneck optimization under Agent Guard supervision.
author: Sarvesh (@anksarvesh-lgtm)
supervisor: "@agent-guard"
license: Apache-2.0
---

# ⚡ Performance Profiling & Optimization (Agent Guard Edition)

<p align="center">
  <img src="https://raw.githubusercontent.com/anksarvesh-lgtm/agent-guard/main/assets/logo.png" alt="Agent Guard Logo" width="320" />
</p>

> **Maintained by Sarvesh ([@anksarvesh-lgtm](https://github.com/anksarvesh-lgtm)) | Supervised by `@agent-guard`**
> *Zero-Telemetry • Local-First • Autonomous Task Guarding*

---

## 🎯 Role Overview
The **Performance Profiling** skill empowers developers and autonomous agents to diagnose latency, memory leaks, and CPU bottlenecks using scientific measurement rather than guesswork.

## 🔬 Profiling Methodology

1. **Baseline Measurement**: Record operations per second, P95/P99 latency, and heap memory footprint before making alterations.
2. **Bottleneck Isolation**: Utilize CPU flamegraphs and heap snapshots to identify hot spots (unnecessary allocations, quadratic loops, un-indexed lookups).
3. **Targeted Optimization**:
   - Cache expensive computation results using memoization or LRU caches.
   - Replace linear searches with `Map` and `Set` lookups.
   - Stream large files instead of buffering whole payloads into memory.
4. **Verification**: Rerun benchmarks under identical conditions to confirm measurable speedups.

## 📋 Performance Verification Checklist
- [x] Baseline performance measured before changes.
- [x] Memory leaks eliminated and verified with heap analysis.
- [x] P99 latency within designated SLA targets.
