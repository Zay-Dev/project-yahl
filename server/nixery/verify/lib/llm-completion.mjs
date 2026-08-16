import {
  callChat,
  callChatWithLog,
  hasRealApiKey,
  logProgress,
} from './run-agent.mjs';

const extractJsonBlob = (text) => {
  if (typeof text !== 'string' || !text.trim()) {
    return '';
  }

  const match = text.match(/\{[\s\S]*\}/);

  return match?.[0]?.trim() || text.trim();
};

const getReasoningText = (message) => {
  if (!message || typeof message !== 'object') {
    return '';
  }

  const record = message;
  const reasoningValue = record.reasoning_content ?? record.reasoning;

  if (typeof reasoningValue !== 'string') {
    return '';
  }

  return reasoningValue.trim();
};

export const resolveLlmMessageText = (params) => {
  const choice = params.choice;
  const finishReason = typeof params.finishReason === 'string' ? params.finishReason : '';
  const content = typeof choice?.content === 'string' ? choice.content.trim() : '';
  const reasoning = getReasoningText(choice);

  if (finishReason === 'length') {
    throw new Error(
      'openai chat finish_reason=length (output truncated; raise OPENAI_MAX_TOKENS or shorten verify feedback)',
    );
  }

  if (content) {
    return content;
  }

  const fromReasoning = extractJsonBlob(reasoning);

  if (fromReasoning) {
    return fromReasoning;
  }

  return '';
};

export const runSingleLlmCompletion = async (params) => {
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
  const baseUrl = process.env.OPENAI_BASE_URL?.trim() ?? 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o';
  const temperature = Number(process.env.OPENAI_TEMPERATURE ?? '0.2');
  const maxTokens = process.env.OPENAI_MAX_TOKENS
    ? Number(process.env.OPENAI_MAX_TOKENS)
    : 8192;
  const round = Number.isFinite(params.round) ? params.round : 0;

  if (!hasRealApiKey(apiKey) && !process.env.HTTPS_PROXY && !process.env.HTTP_PROXY) {
    throw new Error('OPENAI_API_KEY is required when OneCLI proxy env is not set');
  }

  const json = await callChatWithLog(params.defId, round, () => callChat({
    apiKey,
    baseUrl,
    maxTokens: Number.isFinite(maxTokens) ? maxTokens : undefined,
    messages: params.messages,
    model,
    temperature: Number.isFinite(temperature) ? temperature : 0.2,
  }));

  const choice = json.choices?.[0]?.message;
  const finishReason = typeof json.choices?.[0]?.finish_reason === 'string'
    ? json.choices[0].finish_reason
    : '';

  if (!choice) {
    throw new Error('openai chat returned no message');
  }

  const reasoningChars = getReasoningText(choice).length;

  logProgress(
    params.defId,
    `llm content_chars=${String(choice.content ?? '').length}`
    + ` reasoning_chars=${reasoningChars}`
    + ` finish_reason=${finishReason || 'none'}`,
  );

  return resolveLlmMessageText({ choice, finishReason });
};
