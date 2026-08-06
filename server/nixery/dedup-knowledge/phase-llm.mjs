import { hasRealApiKey } from '/opt/nixery/_shared/run-agent.mjs';
import { withLlmCallRetry } from '/opt/nixery/_shared/llm-retry.mjs';

const PHASES = ['plan', 'execute', 'review'];

const readEnv = (key) => process.env[key]?.trim() ?? '';

const firstNonEmpty = (keys) => {
  for (const key of keys) {
    const value = readEnv(key);

    if (value) {
      return value;
    }
  }

  return '';
};

const modelFallbackChains = {
  execute: ['OPENAI_MODEL_EXECUTE'],
  plan: ['OPENAI_MODEL_PLAN', 'OPENAI_MODEL_EXECUTE'],
  review: ['OPENAI_MODEL_REVIEW', 'OPENAI_MODEL_PLAN', 'OPENAI_MODEL_EXECUTE'],
};

const baseUrlFallbackChains = {
  execute: ['OPENAI_BASE_URL_EXECUTE', 'OPENAI_BASE_URL'],
  plan: ['OPENAI_BASE_URL_PLAN', 'OPENAI_BASE_URL_EXECUTE', 'OPENAI_BASE_URL'],
  review: [
    'OPENAI_BASE_URL_REVIEW',
    'OPENAI_BASE_URL_PLAN',
    'OPENAI_BASE_URL_EXECUTE',
    'OPENAI_BASE_URL',
  ],
};

const defaultModels = {
  execute: 'deepseek-v4-flash',
  plan: 'deepseek-v4-pro',
  review: 'deepseek-v4-pro',
};

const defaultTemperature = {
  execute: 0.1,
  plan: 0.3,
  review: 0.2,
};

export const resolvePhaseLlmConfig = (phase) => {
  if (!PHASES.includes(phase)) {
    throw new Error(`unknown nixery phase: ${phase}`);
  }

  const model = firstNonEmpty(modelFallbackChains[phase]) || defaultModels[phase];
  const baseUrl = firstNonEmpty(baseUrlFallbackChains[phase]) || 'https://api.openai.com/v1';
  const temperatureKey = `OPENAI_TEMPERATURE_${phase.toUpperCase()}`;
  const maxTokensKey = `OPENAI_MAX_TOKENS_${phase.toUpperCase()}`;
  const temperatureRaw = readEnv(temperatureKey);
  const maxTokensRaw = readEnv(maxTokensKey);

  return {
    apiKey: readEnv('OPENAI_API_KEY'),
    baseUrl,
    maxTokens: maxTokensRaw ? Number(maxTokensRaw) : undefined,
    model,
    temperature: temperatureRaw ? Number(temperatureRaw) : defaultTemperature[phase],
  };
};

export const callChatForPhase = async (phase, params) => {
  const config = resolvePhaseLlmConfig(phase);
  const base = config.baseUrl.replace(/\/+$/, '');
  const url = `${base}/chat/completions`;
  const headers = {
    'Content-Type': 'application/json',
  };

  if (hasRealApiKey(config.apiKey)) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  return withLlmCallRetry(async () => {
    const response = await fetch(url, {
      body: JSON.stringify({
        max_tokens: params.maxTokens ?? config.maxTokens,
        messages: params.messages,
        model: params.model ?? config.model,
        temperature: params.temperature ?? config.temperature,
        tools: params.tools,
      }),
      headers,
      method: 'POST',
    });

    if (!response.ok) {
      const body = await response.text();
      const error = new Error(
        `openai chat failed (${phase}): ${response.status} ${body.slice(0, 500)}`,
      );
      error.status = response.status;
      throw error;
    }

    return response.json();
  });
};
