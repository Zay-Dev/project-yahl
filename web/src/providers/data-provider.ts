import type { DataProvider } from "@refinedev/core";
import simpleRest from "@refinedev/simple-rest";

import { API_BASE_URL, RESOURCES } from "@/providers/constants";
import { getSessionsSnapshot } from "@/providers/sessions-cache";

const base = simpleRest(API_BASE_URL);

const isHealthGetOne = (resource?: string, id?: string | number) =>
  resource === "__" && String(id) === "health";

const fetchHealthAllowingDegraded = async () => {
  const res = await fetch(`${API_BASE_URL}/__/health`);
  const body = await res.json() as unknown;

  if (res.ok || (res.status === 503 && body && typeof body === "object")) {
    return { data: body };
  }

  const message =
    body && typeof body === "object" && "message" in body && typeof body.message === "string"
      ? body.message
      : `Health request failed (${res.status})`;

  throw Object.assign(new Error(message), { statusCode: res.status });
};

export const dataProvider: DataProvider = {
  ...base,
  custom: async (params) => {
    const url = params.url.startsWith("http")
      ? params.url
      : `${API_BASE_URL}${params.url}`;

    return base.custom({ ...params, url });
  },
  getList: async (params) => {
    if (params.resource === RESOURCES.sessions) {
      const data = getSessionsSnapshot();

      return { data, total: data.length } as never;
    }

    return base.getList(params);
  },
  getOne: async (params) => {
    if (isHealthGetOne(params.resource, params.id)) {
      return fetchHealthAllowingDegraded() as never;
    }

    return base.getOne(params);
  },
};
