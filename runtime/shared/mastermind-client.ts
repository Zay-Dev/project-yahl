const mastermindBaseUrl = () =>
  (process.env.MASTERMIND_API_URL?.trim() || 'http://mastermind:4100').replace(/\/+$/, '');

export type TMastermindSkillResponse = {
  data?: unknown;
  error?: string;
  ok: boolean;
};

export type TMastermindVerifyResponse = {
  feedback: string;
  pass: boolean;
  score: number;
};

export const callMastermindSkill = async (
  name: string,
  args: Record<string, unknown>,
  sessionId?: string,
): Promise<TMastermindSkillResponse> => {
  const url = `${mastermindBaseUrl()}/v1/skills/${encodeURIComponent(name)}`;
  const startedAt = Date.now();

  console.log(`[mastermind-client] POST ${name} url=${mastermindBaseUrl()} sessionId=${sessionId ?? '-'}`);

  try {
    const res = await fetch(url, {
      body: JSON.stringify({
        args,
        caller: 'stage-agent',
        sessionId,
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    const body = await res.json() as TMastermindSkillResponse;
    const durationMs = Date.now() - startedAt;

    console.log(
      `[mastermind-client] ${name} http=${res.status} ok=${body.ok} durationMs=${durationMs}`,
    );

    if (!res.ok) {
      return {
        error: body.error ?? `mastermind ${name}: HTTP ${res.status}`,
        ok: false,
      };
    }

    return body;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : 'mastermind request failed';

    console.log(`[mastermind-client] ${name} failed durationMs=${durationMs} error=${message}`);

    return {
      error: message,
      ok: false,
    };
  }
};

export const callMastermindVerify = async (body: {
  contextSnapshot: Record<string, unknown>;
  minScore?: number;
  requestId: string;
  rubric?: string;
  sessionId: string;
  stageIndex: number;
  stageVersion?: number;
}): Promise<TMastermindVerifyResponse> => {
  const url = `${mastermindBaseUrl()}/v1/verify`;
  const startedAt = Date.now();

  console.log(
    `[mastermind-client] POST verify sessionId=${body.sessionId} requestId=${body.requestId} stageIndex=${body.stageIndex}`,
  );

  try {
    const res = await fetch(url, {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    if (!res.ok) {
      const durationMs = Date.now() - startedAt;

      console.log(
        `[mastermind-client] verify http=${res.status} pass=false durationMs=${durationMs}`,
      );
      throw new Error(`mastermind verify failed: ${res.status}`);
    }

    const result = await res.json() as TMastermindVerifyResponse;
    const durationMs = Date.now() - startedAt;

    console.log(
      `[mastermind-client] verify http=${res.status} pass=${result.pass} score=${result.score} durationMs=${durationMs}`,
    );

    return result;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('mastermind verify failed:')) {
      throw error;
    }

    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : 'mastermind verify request failed';

    console.log(`[mastermind-client] verify failed durationMs=${durationMs} error=${message}`);

    throw error;
  }
};
