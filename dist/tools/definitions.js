import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
export const AGENT_GUARD_INSTRUCTIONS = `# Agent Guard MCP Tools Instructions

Agent Guard provides deterministic, zero-telemetry development supervision, OS keep-awake prevention, 1% quota account switching, model token budgeting, and SOTA model compression.

## Tools Overview
- \`task_start\`: Initialize a crash-proof DAG task before any multi-step programming or refactoring.
- \`task_checkpoint\`: Record atomic progress after every finished step with proof in the note, or record failed status after errors.
- \`task_status\`: Query active task state, remaining steps, and blockages. Call on resume.
- \`keep_awake\`: Acquire or release native OS sleep-prevention leases (caffeinate on macOS, SetThreadExecutionState on Windows).
- \`repo_brief\`: Inspect concise architectural map, key commands, and codebase layout.
- \`agent_enforce\`: Verify code quality and enforce mandatory project rules before checkpoints.
- \`token_counter\`: Estimate token footprints and monitor live quota headroom.
- \`account_switcher\`: Manage Antigravity account pool and non-disruptively rotate accounts at <= 1% quota.
- \`model_compressor\`: Recommend, quantize, and configure LLM/VLM compression pipelines (AWQ, GPTQ, SmoothQuant, FastV).
- \`skill_activate\`: Dynamically activate and inject any of the 3,600+ procedural skills into context and workspace on-demand.
- \`memory_store\`: Persistently store architectural decisions, learnings, and conventions across sessions.
- \`memory_recall\`: Recall past decisions, lessons learned, and solutions across sessions via semantic search.
- \`code_map\`: Query high-speed AST code graph, find declarations/callers, and slice exact symbol code without reading full files (90%+ token savings).

Always pass \`project_path\` to target workspace operations.
`;
export const AGENT_GUARD_TOOLS = [
    {
        name: 'task_start',
        description: 'Start a tracked task. Give the goal and the list of steps. Call this before any multi-step work.',
        inputSchema: {
            type: 'object',
            properties: {
                goal: {
                    type: 'string',
                    description: 'Clear statement of the task goal (max 500 chars).',
                },
                steps: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            title: { type: 'string', description: 'Step description (max 200 chars).' },
                            depends_on: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'IDs of preceding steps required before this step (e.g. ["s1"]).',
                            },
                        },
                        required: ['title'],
                    },
                    description: 'Ordered list of steps to accomplish the goal (max 30 steps).',
                },
                max_tries: {
                    type: 'number',
                    description: 'Maximum retries per step before blocking (1-5, default 3).',
                },
                replace: {
                    type: 'boolean',
                    description: 'Set to true to archive an existing active task and start a new one.',
                },
                project_path: {
                    type: 'string',
                    description: 'Absolute path to workspace directory (recommended).',
                },
            },
            required: ['goal', 'steps'],
        },
    },
    {
        name: 'task_checkpoint',
        description: 'Report progress on a step: done, failed or in_progress, with a short note. Call after every step and after every error.',
        inputSchema: {
            type: 'object',
            properties: {
                step_id: {
                    type: 'string',
                    description: 'Identifier of the step being updated (e.g. "s1").',
                },
                status: {
                    type: 'string',
                    enum: ['in_progress', 'done', 'failed'],
                    description: 'New step status.',
                },
                note: {
                    type: 'string',
                    description: 'Proof of completion for done (min 10 chars, e.g. test results), or explanation.',
                },
                error: {
                    type: 'string',
                    description: 'Error output or failure reason if step failed (max 500 chars).',
                },
                add_steps: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            title: { type: 'string' },
                            depends_on: { type: 'array', items: { type: 'string' } },
                        },
                        required: ['title'],
                    },
                    description: 'New steps discovered during work to append to task.',
                },
                project_path: {
                    type: 'string',
                    description: 'Absolute path to workspace directory.',
                },
            },
            required: ['step_id', 'status', 'note'],
        },
    },
    {
        name: 'task_status',
        description: 'Show the current task, the step in progress and what is blocked. Call first after any error or when resuming.',
        inputSchema: {
            type: 'object',
            properties: {
                project_path: {
                    type: 'string',
                    description: 'Absolute path to workspace directory.',
                },
            },
        },
    },
    {
        name: 'keep_awake',
        description: 'Keep the computer awake for a number of minutes, or release it.',
        inputSchema: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['hold', 'release', 'status'],
                    description: 'Awake action to perform.',
                },
                minutes: {
                    type: 'number',
                    description: 'Duration in minutes to hold awake (1 to 240, default 30).',
                },
                reason: {
                    type: 'string',
                    description: 'Optional task or operation reason for the hold.',
                },
                project_path: {
                    type: 'string',
                    description: 'Absolute path to workspace directory.',
                },
            },
            required: ['action'],
        },
    },
    {
        name: 'repo_brief',
        description: 'Get a short summary of this project: layout, commands, traps. Read it before exploring files.',
        inputSchema: {
            type: 'object',
            properties: {
                refresh: {
                    type: 'boolean',
                    description: 'Force a fresh rebuild of the brief even if cached.',
                },
                project_path: {
                    type: 'string',
                    description: 'Absolute path to workspace directory.',
                },
            },
        },
    },
    {
        name: 'agent_enforce',
        description: 'Communicate directives with active agents and force them to complete pending task steps.',
        inputSchema: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['status', 'broadcast', 'force_next'],
                    description: 'Enforcement action: check agent status, broadcast directive, or force next step.',
                },
                directive: {
                    type: 'string',
                    description: 'Custom directive or instruction text to enforce (max 300 chars).',
                },
                target_agent: {
                    type: 'string',
                    description: 'Target agent conversation ID or "all" (defaults to "all").',
                },
                project_path: {
                    type: 'string',
                    description: 'Absolute path to workspace directory.',
                },
            },
            required: ['action'],
        },
    },
    {
        name: 'token_counter',
        description: 'Measure tokens used and remaining across Gemini, Claude, OpenAI, and DeepSeek. Check context budget headroom and prevent overflow.',
        inputSchema: {
            type: 'object',
            properties: {
                model: {
                    type: 'string',
                    description: 'Target model: gemini-1.5-pro, gemini-2.0-flash, claude-3-5-sonnet, gpt-4o, o1, deepseek-chat, etc.',
                },
                text: {
                    type: 'string',
                    description: 'Optional raw text snippet to count tokens for.',
                },
                file_path: {
                    type: 'string',
                    description: 'Optional file path to measure token size for.',
                },
                transcript_path: {
                    type: 'string',
                    description: 'Optional path to conversation transcript JSONL file.',
                },
                compare_all: {
                    type: 'boolean',
                    description: 'Include cross-model comparison table across Gemini, Claude, OpenAI, and DeepSeek (default true).',
                },
                project_path: {
                    type: 'string',
                    description: 'Absolute path to workspace directory.',
                },
            },
        },
    },
    {
        name: 'account_switcher',
        description: 'Seamlessly rotate and manage Antigravity and AI agent accounts. Automatically switches accounts when quota reaches 1% without disturbing task execution.',
        inputSchema: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['status', 'switch', 'list', 'add', 'snapshot', 'import_stock', 'remove', 'auto_rotate', 'configure'],
                    description: 'Action: status, switch to account, list all accounts, add account, snapshot active session, import_stock auth cache, remove account, trigger auto_rotate check, or configure threshold.',
                },
                account_id: {
                    type: 'string',
                    description: 'Target account ID (e.g. "acc-backup-1") for switch or add.',
                },
                name: {
                    type: 'string',
                    description: 'Display name for new account profile.',
                },
                provider: {
                    type: 'string',
                    enum: ['antigravity', 'gemini', 'claude', 'openai', 'custom'],
                    description: 'Provider type (defaults to antigravity).',
                },
                token_content: {
                    type: 'string',
                    description: 'Optional OAuth token JSON string for new account.',
                },
                token_source_file: {
                    type: 'string',
                    description: 'Optional file path to import token from.',
                },
                api_key: {
                    type: 'string',
                    description: 'Optional API key for API key-based models.',
                },
                threshold_percent: {
                    type: 'number',
                    description: 'Quota percentage remaining threshold for auto-switch (default: 1.0%).',
                },
                enabled: {
                    type: 'boolean',
                    description: 'Enable or disable automatic switching at threshold.',
                },
                reason: {
                    type: 'string',
                    description: 'Reason for manual or automatic rotation.',
                },
                project_path: {
                    type: 'string',
                    description: 'Absolute path to workspace directory.',
                },
            },
            required: ['action'],
        },
    },
    {
        name: 'model_compressor',
        description: 'SOTA AIGC Model & Token Compression Suite (AgentCompress / LightCompress). Quantize LLMs, VLMs, and video diffusion models, prune redundant tokens, estimate memory savings, and generate deployment configs.',
        inputSchema: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['estimate', 'recommend', 'list_algos', 'list_models', 'generate_config'],
                    description: 'Action: estimate memory footprint, recommend compression strategy, list supported algorithms, list supported models, or generate YAML config.',
                },
                param_billions: {
                    type: 'number',
                    description: 'Model parameters in billions (e.g. 7, 70, 671).',
                },
                weight_bits: {
                    type: 'number',
                    enum: [2, 3, 4, 8],
                    description: 'Target weight precision bit-width (default: 4).',
                },
                act_bits: {
                    type: 'number',
                    enum: [4, 8, 16],
                    description: 'Target activation precision bit-width (default: 16).',
                },
                kv_bits: {
                    type: 'number',
                    enum: [2, 4, 8, 16],
                    description: 'Target KV cache precision bit-width (default: 16).',
                },
                model_type: {
                    type: 'string',
                    description: 'Model architecture family (e.g. "Llama", "Qwen2VL", "DeepSeekV3", "Wan2.1").',
                },
                available_vram_gb: {
                    type: 'number',
                    description: 'Available GPU VRAM in GB (e.g. 24, 80).',
                },
                optimization_goal: {
                    type: 'string',
                    enum: ['balanced', 'maximum_throughput', 'minimum_vram', 'highest_accuracy'],
                    description: 'Optimization goal (default: balanced).',
                },
                model_path: {
                    type: 'string',
                    description: 'Model identifier or path for configuration generation.',
                },
                method: {
                    type: 'string',
                    description: 'Quantization or token reduction method (e.g. "Awq", "Gptq", "SmoothQuant", "FastV").',
                },
                backend: {
                    type: 'string',
                    enum: ['vllm', 'sglang', 'autoawq', 'lightllm', 'fake_quant', 'lightx2v'],
                    description: 'Deployment serving backend (default: vllm).',
                },
                project_path: {
                    type: 'string',
                    description: 'Absolute path to workspace directory.',
                },
            },
            required: ['action'],
        },
    },
    {
        name: 'skill_activate',
        description: 'Dynamically search, activate, and inject procedural runbooks from the 3,600+ master skill library directly into your context and workspace. Use whenever you need instructions for cloud services (Stripe, Jira, Slack, AWS), frameworks, testing, databases, or documents.',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The task, framework, cloud service, or workflow you need a procedural skill for (e.g. "stripe billing", "kubernetes helm", "word document report", "prisma migration").',
                },
                project_path: {
                    type: 'string',
                    description: 'Workspace root path to automatically link the skill into .agents/skills/ (optional).',
                },
                auto_install: {
                    type: 'boolean',
                    description: 'Whether to permanently link this skill into the workspace .agents/skills/ directory (default: true).',
                },
                limit: {
                    type: 'number',
                    description: 'Maximum candidate matches to inspect (default: 3).',
                },
            },
            required: ['query'],
        },
    },
    {
        name: 'memory_store',
        description: 'Save an insight, architectural decision, or learning to persistent project memory. Use when the user says "remember this", "save this", "note that", or to preserve cross-session knowledge.',
        inputSchema: {
            type: 'object',
            properties: {
                content: {
                    type: 'string',
                    description: 'The knowledge, rule, or decision to remember.',
                },
                tags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Searchable topic tags (e.g. ["auth", "database", "api"]).',
                },
                category: {
                    type: 'string',
                    enum: ['decision', 'architecture', 'learning', 'convention', 'general'],
                    description: 'Category of memory entry (default: general).',
                },
                project_path: {
                    type: 'string',
                    description: 'Workspace root folder (defaults to current project).',
                },
            },
            required: ['content'],
        },
    },
    {
        name: 'memory_recall',
        description: 'Search and retrieve stored project memories, decisions, and patterns from previous sessions. Call when starting work or researching past context.',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Keywords, topic, or concept to recall.',
                },
                limit: {
                    type: 'number',
                    description: 'Maximum memories to retrieve (default: 5).',
                },
                tag: {
                    type: 'string',
                    description: 'Optional filter by specific tag.',
                },
                category: {
                    type: 'string',
                    description: 'Optional filter by category.',
                },
                project_path: {
                    type: 'string',
                    description: 'Workspace root folder (defaults to current project).',
                },
            },
            required: ['query'],
        },
    },
    {
        name: 'code_map',
        description: 'High-speed AST code knowledge graph and symbol slicer. Query declarations (functions, classes, routes), find callers, or slice exact symbol code without reading full files (90%+ token savings).',
        inputSchema: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['overview', 'symbols', 'lookup', 'slice', 'callers'],
                    description: 'overview: high-level architecture & route map; symbols: list symbols in file/pattern; lookup: find symbol declarations; slice: extract exact lines of symbol; callers: find references & calls.',
                },
                symbol_name: {
                    type: 'string',
                    description: 'Name of function, class, interface, method, or route (required for lookup, slice, callers).',
                },
                file_path: {
                    type: 'string',
                    description: 'Relative or absolute file path or directory pattern (e.g. "src/tools" or "src/brief/build.ts").',
                },
                project_path: {
                    type: 'string',
                    description: 'Workspace root folder (defaults to current project).',
                },
                force_refresh: {
                    type: 'boolean',
                    description: 'Force re-parsing source files instead of using cached graph.',
                },
            },
        },
    },
];
export function syncMcpSchemaFiles(customDirs) {
    const home = process.env.AGENT_GUARD_HOME || os.homedir();
    const dirs = customDirs || [
        path.join(home, '.gemini', 'antigravity', 'mcp', 'agent-guard'),
        path.join(home, '.gemini', 'antigravity-ide', 'mcp', 'agent-guard'),
        path.join(home, '.gemini', 'antigravity', 'mcp', 'agent-guard_agent-guard'),
    ];
    const writtenDirs = [];
    for (const dir of dirs) {
        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            for (const tool of AGENT_GUARD_TOOLS) {
                const filePath = path.join(dir, `${tool.name}.json`);
                const schema = {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.inputSchema,
                };
                fs.writeFileSync(filePath, JSON.stringify(schema, null, 2), 'utf8');
            }
            fs.writeFileSync(path.join(dir, 'instructions.md'), AGENT_GUARD_INSTRUCTIONS, 'utf8');
            writtenDirs.push(dir);
        }
        catch {
            // Best-effort
        }
    }
    return writtenDirs;
}
export async function refreshAntigravityLsMcp() {
    const address = process.env.ANTIGRAVITY_LS_ADDRESS;
    const token = process.env.ANTIGRAVITY_CSRF_TOKEN;
    if (!address)
        return false;
    try {
        const res = await fetch(`http://${address}/exa.language_server_pb.LanguageServerService/RefreshMcpServers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-codeium-csrf-token': token || '',
            },
            body: JSON.stringify({}),
        });
        return res.ok;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=definitions.js.map