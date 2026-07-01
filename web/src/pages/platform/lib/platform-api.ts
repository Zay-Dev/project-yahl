import type {
  TRequestCreateCronJobBody,
  TRequestUpdateCronJobBody,
  TResponseCronJob,
  TResponseCronJobListItem,
  TResponseCronJobMutation,
  TResponseCronJobs,
} from "@project-yahl/server/modules/platform/-api-types";

import { API_BASE_URL } from "@/providers/constants";

const cronJobsBase = `${API_BASE_URL}/api/platform/cron/jobs`;

const parsePayload = <T>(json: T & { data?: T }) => json.data ?? json;

const parseError = async (res: Response, fallback: string) => {
  try {
    const json = await res.json() as { error?: string; message?: string };

    return json.error ?? json.message ?? fallback;
  } catch {
    return fallback;
  }
};

export const listCronJobs = async (): Promise<TResponseCronJobListItem[]> => {
  const res = await fetch(cronJobsBase);

  if (!res.ok) {
    throw new Error(`Failed to list cron jobs: ${res.status}`);
  }

  const json = await res.json() as TResponseCronJobs & { data?: TResponseCronJobs };
  const payload = parsePayload(json);

  return payload.items ?? [];
};

export const getCronJob = async (id: string): Promise<TResponseCronJob> => {
  const res = await fetch(`${cronJobsBase}/${encodeURIComponent(id)}`);

  if (!res.ok) {
    throw new Error(await parseError(res, `Failed to load cron job: ${res.status}`));
  }

  const json = await res.json() as TResponseCronJob & { data?: TResponseCronJob };

  return parsePayload(json);
};

export const createCronJob = async (body: TRequestCreateCronJobBody): Promise<TResponseCronJobMutation> => {
  const res = await fetch(cronJobsBase, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (!res.ok) {
    throw new Error(await parseError(res, `Failed to create cron job: ${res.status}`));
  }

  const json = await res.json() as TResponseCronJobMutation & { data?: TResponseCronJobMutation };

  return parsePayload(json);
};

export const updateCronJob = async (
  id: string,
  body: TRequestUpdateCronJobBody,
): Promise<TResponseCronJob> => {
  const res = await fetch(`${cronJobsBase}/${encodeURIComponent(id)}`, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });

  if (!res.ok) {
    throw new Error(await parseError(res, `Failed to update cron job: ${res.status}`));
  }

  const json = await res.json() as TResponseCronJob & { data?: TResponseCronJob };

  return parsePayload(json);
};

export const deleteCronJob = async (id: string): Promise<TResponseCronJobMutation> => {
  const res = await fetch(`${cronJobsBase}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error(await parseError(res, `Failed to delete cron job: ${res.status}`));
  }

  const json = await res.json() as TResponseCronJobMutation & { data?: TResponseCronJobMutation };

  return parsePayload(json);
};
