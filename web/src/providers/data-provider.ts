import type { DataProvider } from "@refinedev/core";
import simpleRest from "@refinedev/simple-rest";

import { API_BASE_URL, RESOURCES } from "@/providers/constants";
import { getSessionsSnapshot } from "@/providers/sessions-cache";

const base = simpleRest(API_BASE_URL);

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
};
