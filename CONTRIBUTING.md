# Contributing to Agent Guard

Thank you for your interest in improving **Agent Guard**! We welcome contributions, bug fixes, documentation improvements, and ideas from the community.

---

## Code of Conduct

All contributors are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before participating in our issues or discussions.

---

## Development Setup

### 1. Prerequisites
- **Node.js**: Version 20.0.0 or higher.
- **Git**: Installed and configured.

### 2. Getting the Code
```bash
git clone https://github.com/anksarvesh-lgtm/agent-guard.git
cd agent-guard
npm install
```

### 3. Build & Watch
```bash
npm run build      # One-off compilation to dist/
npm run watch      # TypeScript watch mode
```

### 4. Running the Test Suite
We use **Vitest** for fast unit and integration testing:
```bash
npm test           # Run all 40 tests
npm run test:watch # Run tests in interactive watch mode
```

---

## Architecture Principles

When proposing or implementing changes, you must adhere to Agent Guard's core design tenets:

1. **Zero External Telemetry**:
   - Never introduce dependencies that make external network requests, phoning home, or cloud tracking.
   - All state must reside in local JSON files inside `<project>/.agent/`.

2. **Strict Token Economy**:
   - Every tool description and response is injected into the AI model's context window.
   - Keep tool output plain text, concise, and bounded.
   - Truncate long strings using `[cut]`.
   - Never dump huge stack traces or raw outputs into LLM context.

3. **Crash Resilience & Atomic Writes**:
   - Writes to `.agent/ledger.json` must be atomic (write to temp file, then rename).
   - Maintain concurrency locks with 30s stale eviction.
   - Always preserve previous states in `ledger.prev.json` for self-healing.

4. **Fail-Open Hooks**:
   - The Antigravity Stop hook and lifecycle bridges must **never** hang, trap the IDE, or throw unhandled exceptions.
   - All hook logic must fail safely to permit normal editor functionality.

---

## Pull Request Guidelines

1. Fork the repo and create a feature branch (`git checkout -b feature/my-feature`).
2. Write unit tests in `test/` verifying all new logic.
3. Ensure all tests pass (`npm test`) and code compiles without errors (`npm run build`).
4. Commit your changes with clear, descriptive commit messages.
5. Submit a Pull Request targeting the `main` branch.
