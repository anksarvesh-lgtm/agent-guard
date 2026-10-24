/**
 * Generates the pure-JS extension code that runs inside VS Code / Antigravity IDE / Cursor / Windsurf.
 * Uses zero external npm dependencies, running strictly on Node.js and the vscode API.
 * Provides complete control over every Agent Guard feature:
 * - Real-time Language Server RPC Quota integration (Gemini 5h/weekly, Claude/GPT 5h/weekly, prompt credits)
 * - Multi-layer account switching (jetski token, state.vscdb, accounts pool, IDE sync)
 * - Sleep Prevention lease management
 * - Auto-Accept Turbo & tool grant manager
 * - Token Counter & Model budgeting
 * - 1% Tripwire pool manager & active snapshotting
 * - Task Supervisor & Ledger controls
 * - Skills catalog browser
 * - Live Doctor diagnostics & updates
 */
export declare function generateExtensionRuntimeScript(): string;
//# sourceMappingURL=runtime.d.ts.map