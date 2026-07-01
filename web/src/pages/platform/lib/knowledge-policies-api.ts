import type {
  TRequestPatchKnowledgePolicyBody,
  TResponseTopicPolicies,
  TResponseTopicPolicy,
  TTopicRefreshInterval,
} from "@project-yahl/server/modules/platform/-api-types";

import { API_BASE_URL } from "@/providers/constants";

const policiesBase = `${API_BASE_URL}/api/platform/knowledge-policies`;

const parsePayload = <T>(json: T & { data?: T }) => json.data ?? json;

const parseError = async (res: Response, fallback: string) => {
  try {
    const json = await res.json() as { error?: string; message?: string };

    return json.error ?? json.message ?? fallback;
  } catch {
    return fallback;
  }
};

export const listKnowledgePolicies = async (): Promise<TResponseTopicPolicy[]> => {
  const res = await fetch(policiesBase);

  if (!res.ok) {
    throw new Error(`Failed to list knowledge policies: ${res.status}`);
  }

  const json = await res.json() as TResponseTopicPolicies & { data?: TResponseTopicPolicies };
  const payload = parsePayload(json);

  return payload.items ?? [];
};

export const patchKnowledgePolicy = async (
  slug: string,
  body: TRequestPatchKnowledgePolicyBody,
): Promise<TResponseTopicPolicy> => {
  const res = await fetch(`${policiesBase}/${encodeURIComponent(slug)}`, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });

  if (!res.ok) {
    throw new Error(await parseError(res, `Failed to update policy: ${res.status}`));
  }

  const json = await res.json() as TResponseTopicPolicy & { data?: TResponseTopicPolicy };

  return parsePayload(json);
};

export const REFRESH_INTERVAL_OPTIONS: { label: string; value: TTopicRefreshInterval | null }[] = [
  { label: "Off", value: null },
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Biweekly", value: "biweekly" },
  { label: "Monthly", value: "monthly" },
];
