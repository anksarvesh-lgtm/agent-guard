import { ModelProfile } from './types.js';

export const SUPPORTED_MODELS: Record<string, ModelProfile> = {
  // Google Gemini
  'gemini-1.5-pro': {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'Google Gemini',
    contextWindow: 2000000,
    maxOutputTokens: 8192,
    description: 'Ultra-long context flagship model with 2M token capacity',
    recommendedThreshold: 0.85,
  },
  'gemini-1.5-flash': {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'Google Gemini',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    description: 'Fast, high-throughput long-context model with 1M token capacity',
    recommendedThreshold: 0.85,
  },
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'Google Gemini',
    contextWindow: 1048576,
    maxOutputTokens: 8192,
    description: 'Next-gen multimodal model with 1M+ token context',
    recommendedThreshold: 0.85,
  },
  'gemini-2.0-pro': {
    id: 'gemini-2.0-pro',
    name: 'Gemini 2.0 Pro',
    provider: 'Google Gemini',
    contextWindow: 2000000,
    maxOutputTokens: 8192,
    description: 'Next-gen flagship reasoning model with 2M token context',
    recommendedThreshold: 0.85,
  },
  'antigravity': {
    id: 'antigravity',
    name: 'Google Antigravity IDE (Gemini)',
    provider: 'Google Gemini',
    contextWindow: 2000000,
    maxOutputTokens: 8192,
    description: 'Default Antigravity agent context window',
    recommendedThreshold: 0.85,
  },

  // Anthropic Claude
  'claude-3-5-sonnet': {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic Claude',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    description: 'Leading code generation & tool use model with 200k context',
    recommendedThreshold: 0.75,
  },
  'claude-3-opus': {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'Anthropic Claude',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    description: 'Deep analytical and reasoning model with 200k context',
    recommendedThreshold: 0.75,
  },
  'claude-3-5-haiku': {
    id: 'claude-3-5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'Anthropic Claude',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    description: 'Fast, lightweight Claude model with 200k context',
    recommendedThreshold: 0.75,
  },
  'claude-code': {
    id: 'claude-code',
    name: 'Claude Code CLI',
    provider: 'Anthropic Claude',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    description: 'Anthropic Claude Code CLI context boundary',
    recommendedThreshold: 0.75,
  },

  // OpenAI / Codex
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    description: 'OpenAI flagship omni model with 128k context',
    recommendedThreshold: 0.75,
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    description: 'Cost-efficient OpenAI model with 128k context',
    recommendedThreshold: 0.75,
  },
  'o1': {
    id: 'o1',
    name: 'OpenAI o1',
    provider: 'OpenAI',
    contextWindow: 200000,
    maxOutputTokens: 100000,
    description: 'Extended reasoning model with 200k context window',
    recommendedThreshold: 0.80,
  },
  'o3-mini': {
    id: 'o3-mini',
    name: 'OpenAI o3-mini',
    provider: 'OpenAI',
    contextWindow: 200000,
    maxOutputTokens: 100000,
    description: 'High-speed reasoning model with 200k context window',
    recommendedThreshold: 0.80,
  },
  'codex': {
    id: 'codex',
    name: 'Codex CLI',
    provider: 'OpenAI',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    description: 'Codex CLI context boundary',
    recommendedThreshold: 0.75,
  },

  // DeepSeek
  'deepseek-chat': {
    id: 'deepseek-chat',
    name: 'DeepSeek V3 (Chat)',
    provider: 'DeepSeek',
    contextWindow: 64000,
    maxOutputTokens: 8000,
    description: 'DeepSeek V3 general model with 64k context',
    recommendedThreshold: 0.70,
  },
  'deepseek-r1': {
    id: 'deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'DeepSeek',
    contextWindow: 64000,
    maxOutputTokens: 8000,
    description: 'DeepSeek R1 reasoning model with 64k context',
    recommendedThreshold: 0.70,
  },

  // Open Source & Leading Models
  'llama-3.3-70b': {
    id: 'llama-3.3-70b',
    name: 'Llama 3.3 70B',
    provider: 'Open Source',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    description: 'Meta open-weights model with 128k context',
    recommendedThreshold: 0.75,
  },
  'qwen-2.5-coder': {
    id: 'qwen-2.5-coder',
    name: 'Qwen 2.5 Coder 32B',
    provider: 'Open Source',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    description: 'Alibaba open code intelligence model with 128k context',
    recommendedThreshold: 0.75,
  },
};

export const DEFAULT_MODEL_ID = 'gemini-1.5-pro';

export function resolveModelProfile(identifier?: string): ModelProfile {
  if (!identifier) {
    return SUPPORTED_MODELS[DEFAULT_MODEL_ID];
  }

  const query = identifier.toLowerCase().trim();

  // Exact match
  if (SUPPORTED_MODELS[query]) {
    return SUPPORTED_MODELS[query];
  }

  // Fuzzy match keywords
  if (query.includes('gemini') || query.includes('antigravity')) {
    if (query.includes('flash')) return SUPPORTED_MODELS['gemini-2.0-flash'];
    return SUPPORTED_MODELS['gemini-1.5-pro'];
  }
  if (query.includes('claude') || query.includes('sonnet')) {
    return SUPPORTED_MODELS['claude-3-5-sonnet'];
  }
  if (query.includes('haiku')) {
    return SUPPORTED_MODELS['claude-3-5-haiku'];
  }
  if (query.includes('opus')) {
    return SUPPORTED_MODELS['claude-3-opus'];
  }
  if (query.includes('gpt-4') || query.includes('openai') || query.includes('chatgpt')) {
    return SUPPORTED_MODELS['gpt-4o'];
  }
  if (query.includes('o1') || query.includes('o3')) {
    return SUPPORTED_MODELS['o1'];
  }
  if (query.includes('deepseek')) {
    if (query.includes('r1') || query.includes('reasoner')) {
      return SUPPORTED_MODELS['deepseek-r1'];
    }
    return SUPPORTED_MODELS['deepseek-chat'];
  }
  if (query.includes('llama')) {
    return SUPPORTED_MODELS['llama-3.3-70b'];
  }
  if (query.includes('qwen')) {
    return SUPPORTED_MODELS['qwen-2.5-coder'];
  }

  // Fallback default
  return SUPPORTED_MODELS[DEFAULT_MODEL_ID];
}
