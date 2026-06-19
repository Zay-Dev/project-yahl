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

    if (!res.ok) {
      return {
        error: body.error ?? `mastermind ${name}: HTTP ${res.status}`,
        ok: false,
      };
    }

    return body;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'mastermind request failed',
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

  const res = await fetch(url, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  if (!res.ok) {
    throw new Error(`mastermind verify failed: ${res.status}`);
  }

  return await res.json() as TMastermindVerifyResponse;
};
