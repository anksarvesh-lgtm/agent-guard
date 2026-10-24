#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { handleTaskStart } from './tools/taskStart.js';
import { handleTaskCheckpoint } from './tools/taskCheckpoint.js';
import { handleTaskStatus } from './tools/taskStatus.js';
import { handleKeepAwake } from './tools/keepAwake.js';
import { handleRepoBrief } from './tools/repoBrief.js';
import { handleAgentEnforce } from './tools/agentEnforce.js';
import { handleTokenCounter } from './tools/tokenCounter.js';
import { handleAccountSwitcher } from './tools/accountSwitcher.js';
import { handleModelCompressor } from './tools/modelCompressor.js';
import { maybeBackgroundUpdate } from './update.js';

const server = new Server(
  {
    name: 'agent-guard',
    version: '0.2.9',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register Tool Definitions
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'task_start',
        description:
          'Start a tracked task. Give the goal and the list of steps. Call this before any multi-step work.',
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
        description:
          'Report progress on a step: done, failed or in_progress, with a short note. Call after every step and after every error.',
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
              description:
                'Proof of completion for done (min 10 chars, e.g. test results), or explanation.',
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
        description:
          'Show the current task, the step in progress and what is blocked. Call first after any error or when resuming.',
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
        description:
          'Get a short summary of this project: layout, commands, traps. Read it before exploring files.',
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
        description:
          'Communicate directives with active agents and force them to complete pending task steps.',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['status', 'broadcast', 'force_next'],
              description:
                'Enforcement action: check agent status, broadcast directive, or force next step.',
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
        description:
          'Measure tokens used and remaining across Gemini, Claude, OpenAI, and DeepSeek. Check context budget headroom and prevent overflow.',
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
        description:
          'Seamlessly rotate and manage Antigravity and AI agent accounts. Automatically switches accounts when quota reaches 1% without disturbing task execution.',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['status', 'switch', 'list', 'add', 'snapshot', 'remove', 'auto_rotate', 'configure'],
              description: 'Action: status, switch to account, list all accounts, add account, snapshot active session, remove account, trigger auto_rotate check, or configure threshold.',
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
        description:
          'SOTA AIGC Model & Token Compression Suite (AgentCompress / LightCompress). Quantize LLMs, VLMs, and video diffusion models, prune redundant tokens, estimate memory savings, and generate deployment configs.',
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
        resultText = handleAgentEnforce(args as any);
        break;
      case 'token_counter':
        resultText = handleTokenCounter(args);
        break;
      case 'account_switcher':
        resultText = handleAccountSwitcher(args);
        break;
      case 'model_compressor':
        resultText = handleModelCompressor(args);
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
  } catch (err: any) {
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
  } catch {
    // Non-fatal
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Agent Guard server fatal error:', error);
  process.exit(1);
});
