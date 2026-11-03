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
import { handleIslandStatus, handleIslandNotify } from './tools/island.js';
import { globalIslandBridge } from './island/index.js';
import { AGENT_GUARD_TOOLS, syncMcpSchemaFiles } from './tools/definitions.js';
import { maybeBackgroundUpdate } from './update.js';

const server = new Server(
  {
    name: 'agent-guard',
    version: '0.2.24',
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
    // Notify LiquidDynamo Dynamic Island of tool invocation
    try {
      globalIslandBridge.broadcastToolPre({
        sessionId: (args as any)?.project_path || 'agent-guard',
        toolName: name,
      });
    } catch {}

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
      case 'island_status':
        resultText = handleIslandStatus();
        break;
      case 'island_notify':
        resultText = handleIslandNotify((args || {}) as any);
        break;
      default:
        resultText = `UNKNOWN_TOOL: Tool "${name}" is not supported by agent-guard.`;
        break;
    }

    // Notify LiquidDynamo Dynamic Island of tool result
    try {
      const isErr = resultText.startsWith('UNKNOWN_TOOL') || resultText.startsWith('BAD_INPUT');
      globalIslandBridge.broadcastToolPost({
        sessionId: (args as any)?.project_path || 'agent-guard',
        toolName: name,
        success: !isErr,
        summary: resultText.slice(0, 100),
      });
    } catch {}

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
