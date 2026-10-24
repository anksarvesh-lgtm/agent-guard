#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { handleTaskStart } from './tools/taskStart.js';
import { handleTaskCheckpoint } from './tools/taskCheckpoint.js';
import { handleTaskStatus } from './tools/taskStatus.js';
import { handleKeepAwake } from './tools/keepAwake.js';
import { handleRepoBrief } from './tools/repoBrief.js';
import { handleAgentEnforce } from './tools/agentEnforce.js';
import { maybeBackgroundUpdate } from './update.js';
const server = new Server({
    name: 'agent-guard',
    version: '0.1.0',
}, {
    capabilities: {
        tools: {},
    },
});
// Register Tool Definitions
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
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
        ],
    };
});
// Tool Call Dispatcher
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        let resultText = '';
        switch (name) {
            case 'task_start':
                resultText = handleTaskStart(args);
                break;
            case 'task_checkpoint':
                resultText = handleTaskCheckpoint(args);
                break;
            case 'task_status':
                resultText = handleTaskStatus(args);
                break;
            case 'keep_awake':
                resultText = handleKeepAwake(args);
                break;
            case 'repo_brief':
                resultText = handleRepoBrief(args);
                break;
            case 'agent_enforce':
                resultText = handleAgentEnforce(args);
                break;
            default:
                resultText = `UNKNOWN_TOOL: Tool "${name}" is not supported by agent-guard.`;
                break;
        }
        return {
            content: [
                {
                    type: 'text',
                    text: resultText,
                },
            ],
        };
    }
    catch (err) {
        return {
            content: [
                {
                    type: 'text',
                    text: `INTERNAL_ERROR: ${err.message || String(err)}`,
                },
            ],
        };
    }
});
async function main() {
    try {
        maybeBackgroundUpdate();
    }
    catch {
        // Non-fatal
    }
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((error) => {
    console.error('Agent Guard server fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map