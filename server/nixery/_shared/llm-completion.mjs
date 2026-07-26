import {
  callChat,
  callChatWithLog,
  hasRealApiKey,
  logProgress,
} from './run-agent.mjs';

export const runSingleLlmCompletion = async (params) => {
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
  const baseUrl = process.env.OPENAI_BASE_URL?.trim() ?? 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o';
  const temperature = Number(process.env.OPENAI_TEMPERATURE ?? '0.2');
  const maxTokens = process.env.OPENAI_MAX_TOKENS
    ? Number(process.env.OPENAI_MAX_TOKENS)
    : 8192;

  if (!hasRealApiKey(apiKey) && !process.env.HTTPS_PROXY && !process.env.HTTP_PROXY) {
    throw new Error('OPENAI_API_KEY is required when OneCLI proxy env is not set');
  }

  const json = await callChatWithLog(params.defId, 0, () => callChat({
    apiKey,
    baseUrl,
    maxTokens: Number.isFinite(maxTokens) ? maxTokens : undefined,
    messages: params.messages,
    model,
    temperature: Number.isFinite(temperature) ? temperature : 0.2,
  }));

  const choice = json.choices?.[0]?.message;

  if (!choice) {
    throw new Error('openai chat returned no message');
  }

  logProgress(params.defId, `llm content_chars=${String(choice.content ?? '').length}`);

  return String(choice.content ?? '').trim();
};
