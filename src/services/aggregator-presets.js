/** Built-in aggregator presets — base URLs fixed */

export const AGGREGATOR_PRESETS = {
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'google/gemini-2.0-flash-001',
    keyPlaceholder: 'sk-or-v1-...'
  },
  together: {
    id: 'together',
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-Vision-Free',
    keyPlaceholder: 'together-...'
  },
  fireworks: {
    id: 'fireworks',
    label: 'Fireworks',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    defaultModel: 'accounts/fireworks/models/llama-v3p2-11b-vision-instruct',
    keyPlaceholder: 'fw_...'
  },
  /** OpenCode Console Inference API — OpenAI-compatible */
  opencode: {
    id: 'opencode',
    label: 'OpenCode',
    baseUrl: 'https://opencode.ai/inference/openai/v1',
    defaultModel: 'kimi-k2.5',
    keyPlaceholder: 'OpenCode Console API Key'
  },
};

export function listAggregatorPresets() {
  return Object.values(AGGREGATOR_PRESETS);
}

export function getAggregatorPreset(id) {
  return AGGREGATOR_PRESETS[id] || AGGREGATOR_PRESETS.openrouter;
}

export function matchPresetByBaseUrl(baseUrl) {
  const u = String(baseUrl || '').replace(/\/+$/, '');
  for (const p of Object.values(AGGREGATOR_PRESETS)) {
    if (p.id === 'custom') continue;
    if (p.baseUrl.replace(/\/+$/, '') === u) return p.id;
  }
  return 'openrouter';
}
