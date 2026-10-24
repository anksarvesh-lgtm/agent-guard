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
import { handleSkillActivate } from './tools/skillActivate.js';
import { handleMemoryStore, handleMemoryRecall } from './tools/memory.js';
import { handleCodeMap } from './tools/codeMap.js';
import { AGENT_GUARD_TOOLS, syncMcpSchemaFiles } from './tools/definitions.js';
import { maybeBackgroundUpdate } from './update.js';

const server = new Server(
  {
    name: 'agent-guard',
    version: '0.2.19',
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
    tools: AGENT_GUARD_TOOLS,
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
      case 'skill_activate':
        resultText = handleSkillActivate(args);
        break;
      case 'memory_store':
        resultText = handleMemoryStore(args);
        break;
      case 'memory_recall':
        resultText = handleMemoryRecall(args);
        break;
      case 'code_map':
        resultText = handleCodeMap((args || {}) as any);
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
    syncMcpSchemaFiles();
  } catch {
    // Non-fatal
  }
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
