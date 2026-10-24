# 🛡️ Agent Guard Awesome Skills Catalog

<p align="center">
  <img src="assets/logo.png" alt="Agent Guard Logo" width="380" />
</p>

<p align="center">
  <strong>The Ultimate Curated Agentic Skills Collection for Autonomous Coding</strong><br>
  <em>Supervised by <code>@agent-guard</code> • Developed by <strong>Sarvesh</strong> (<a href="https://github.com/anksarvesh-lgtm">@anksarvesh-lgtm</a>) • Apache-2.0 License</em>
</p>

---

## 🌟 Overview

**Agent Guard Awesome Skills** is a comprehensive, reverse-engineered catalog of **2,740+ curated agentic skills** designed for autonomous pair-programming, AI agents, and developers across **Antigravity**, **Cursor**, **Claude Code**, and **Gemini CLI**.

Every skill operates seamlessly under the supervision of **`@agent-guard`**, enforcing atomic checkpoints, reproducible test proofs, OS keep-awake leases, and multi-agent completion guarantees.

```
       ┌────────────────────────────────────────────────────────────┐
       │              @agent-guard Autonomous Supervisor            │
       └─────────────────────────────┬──────────────────────────────┘
                                     │
      ┌──────────────────────────────┼──────────────────────────────┐
      │                              │                              │
┌─────▼──────────┐            ┌──────▼─────────┐            ┌───────▼────────┐
│ 🛡️ Security    │            │ 🤖 AI & Agents │            │ ⚙️ DevOps      │
│ 266+ Skills    │            │ 200+ Skills    │            │ 167+ Skills    │
└────────────────┘            └────────────────┘            └────────────────┘
```

---

## 🚀 Quick Start (CLI)

Agent Guard includes a built-in skills manager CLI to search, inspect, and install skills into your workspace or IDE configuration.

```bash
# List all featured & core skills
npx agent-guard skills list

# Search skills by keyword or category
npx agent-guard skills search security
npx agent-guard skills search devops
npx agent-guard skills search "ai agent"

# Inspect detailed metadata and documentation for a skill
npx agent-guard skills info ai-agents-architect

# Install a skill into your current workspace or Antigravity skills directory
npx agent-guard skills install clean-architecture
npx agent-guard skills install security-audit --path ~/.gemini/antigravity/skills
```

---

## 🏆 Featured Core Skills (Pre-bundled)

The following high-impact core skills are directly bundled with Agent Guard:

| Skill | Category | Description | Supervisor |
| :--- | :--- | :--- | :--- |
| **`agent-guard`** | `agent-orchestration` | Core autonomous task supervisor, keep-awake manager, and multi-agent completion enforcer. | `@agent-guard` |
| **`ai-agents-architect`** | `ai-agents` | Enterprise multi-agent systems design, tool routing, ReAct loops, and graceful degradation. | `@agent-guard` |
| **`security-audit`** | `security` | Zero-trust vulnerability audit, secret leakage detection, and OWASP defense-in-depth. | `@agent-guard` |
| **`clean-architecture`** | `architecture` | Domain-driven design, concentric layer boundaries, and interface decoupling. | `@agent-guard` |
| **`devops-automation`** | `devops` | GitHub Actions CI/CD pipelines, multi-stage Dockerfiles, and automated release publishing. | `@agent-guard` |
| **`test-driven-development`** | `testing` | Red-Green-Refactor cadence, automated unit/integration suites, and regression locks. | `@agent-guard` |
| **`performance-profiling`** | `code-quality` | Node.js/V8 heap analysis, event-loop lag monitoring, and hot-path algorithm optimization. | `@agent-guard` |
| **`reverse-engineering`** | `developer-tools` | REA static and dynamic analysis, JavaScript AST recovery, and binary inspection. | `@agent-guard` |

---

## 📚 Categorized Skills Directory

Below is an overview of the primary domains represented in the **2,749-skill catalog**:

### 1. 🛡️ Security & Hardening (266+ Skills)
- `security-audit`: Automated repository and dependency vulnerability scanning.
- `007`: Red/Blue team security audit, STRIDE/PASTA threat modeling, and incident response.
- `active-directory-attacks`: Enterprise AD penetration testing and privilege escalation audits.
- `api-security`: OWASP Top 10 API vulnerability prevention and JWT validation.
- `secret-scanner`: Pre-commit regex hooks preventing secret token leakages.

### 2. 🤖 AI, Agents & Orchestration (200+ Skills)
- `agent-guard`: Task ledger checkpoints, keep-awake leases, and multi-agent enforcement.
- `ai-agents-architect`: Multi-agent orchestration, delegation protocols, and supervisor hooks.
- `agent-memory-systems`: Short-term context pruning, vector memory, and knowledge graphs.
- `prompt-engineering`: Few-shot prompting, chain-of-thought, and system prompt optimization.
- `agent-evaluation`: Benchmark scoring, hallucination detection, and deterministic assertions.

### 3. ⚙️ DevOps, Cloud & Infrastructure (310+ Skills)
- `devops-automation`: GitHub Actions workflows, matrix builds, and artifact signing.
- `docker`: Multi-stage Dockerfile generation, layer caching, and rootless execution.
- `kubernetes`: Pod disruption budgets, HPA autoscaling, and ingress routing.
- `terraform-aws`: Infrastructure-as-code patterns for resilient AWS deployments.
- `ci-cd-optimization`: Pipeline caching, parallel test sharding, and fast fail-over.

### 4. 🏛️ Architecture & Clean Design (150+ Skills)
- `clean-architecture`: Hexagonal / Onion architecture, repository pattern, and ports & adapters.
- `api-design`: OpenAPI 3.1 specification design, JSON-RPC, and gRPC contracts.
- `database-design`: PostgreSQL relational modeling, foreign key constraints, and indexing.
- `microservices`: Event-driven messaging, circuit breakers, and distributed tracing.

### 5. 🧪 Testing & Reliability (120+ Skills)
- `test-driven-development`: Red-Green-Refactor enforcement with atomic ledger proofs.
- `vitest-suite`: High-speed unit and integration testing with Vitest.
- `playwright-e2e`: End-to-end browser automation and visual regression testing.
- `chaos-engineering`: Fault injection, connection timeouts, and partition recovery.

---

## 🛠️ Integration with `@agent-guard`

All skills are enhanced when paired with `@agent-guard` in Antigravity or Gemini CLI:

1. **Mention `@agent-guard` in chat**:
   ```markdown
   @agent-guard Audit this project's security posture using the security-audit skill and generate an architectural map.
   ```
2. **Deterministic Step Enforcement**:
   `@agent-guard` monitors progress in `.agent/ledger.json`. If a subagent exits before completing all steps, `@agent-guard` halts the termination and enforces continuation.
3. **Keep-Awake Protection**:
   `@agent-guard` automatically prevents machine sleep during long-running builds, test suites, or multi-agent runs.

---

## 📄 License & Attribution

- **Project**: Agent Guard Awesome Skills
- **Author & Maintainer**: **Sarvesh** ([@anksarvesh-lgtm](https://github.com/anksarvesh-lgtm))
- **License**: [Apache-2.0](LICENSE)
- **Zero Telemetry**: All skills and operations execute completely offline and local-first.
