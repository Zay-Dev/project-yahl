import { config } from './config.js';

export const postModelResponse = async (params: {
  domain: string;
  durationMs: number;
  requestId: string;
  response: Record<string, unknown>;
  sessionId: string;
  tags?: string[];
  thinkingMode?: boolean;
}): Promise<void> => {
  const url = `${config.sessionApiBaseUrl}/api/sessions/`
    + `${encodeURIComponent(params.sessionId)}/stages/`
    + `${encodeURIComponent(params.requestId)}/model-responses`;

  console.log(
    `[llm-proxy] postback start sessionId=${params.sessionId} requestId=${params.requestId}`,
  );

  const response = await fetch(url, {
    body: JSON.stringify({
      domain: params.domain,
      durationMs: params.durationMs,
      response: params.response,
      ...(params.tags?.length ? { tags: params.tags } : {}),
      thinkingMode: params.thinkingMode,
    }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');

    throw new Error(
      `model-response postback failed ${response.status}: ${detail.slice(0, 500)}`,
    );
  }

  console.log(
    `[llm-proxy] postback ok sessionId=${params.sessionId} requestId=${params.requestId}`,
  );
};
