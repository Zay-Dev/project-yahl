import type {
  TRequestPutKnowledgeManagerInstructionBody,
  TResponseKnowledgeManagerInstruction,
} from "@project-yahl/server/modules/platform/-api-types";

import { API_BASE_URL } from "@/providers/constants";

const instructionBase = `${API_BASE_URL}/api/platform/knowledge-manager-instruction`;

const parsePayload = <T>(json: T & { data?: T }) => json.data ?? json;

const parseError = async (res: Response, fallback: string) => {
  try {
    const json = await res.json() as { error?: string; message?: string };

    return json.error ?? json.message ?? fallback;
  } catch {
    return fallback;
  }
};

export const getKnowledgeManagerInstruction = async (): Promise<string> => {
  const res = await fetch(instructionBase);

  if (!res.ok) {
    throw new Error(`Failed to load instruction: ${res.status}`);
  }

  const json = await res.json() as TResponseKnowledgeManagerInstruction & {
    data?: TResponseKnowledgeManagerInstruction;
  };
  const payload = parsePayload(json);

  return payload.text ?? "";
};

export const putKnowledgeManagerInstruction = async (
  body: TRequestPutKnowledgeManagerInstructionBody,
): Promise<string> => {
  const res = await fetch(instructionBase, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "PUT",
  });

  if (!res.ok) {
    throw new Error(await parseError(res, `Failed to save instruction: ${res.status}`));
  }

  const json = await res.json() as TResponseKnowledgeManagerInstruction & {
    data?: TResponseKnowledgeManagerInstruction;
  };

  return parsePayload(json).text ?? body.text;
};
