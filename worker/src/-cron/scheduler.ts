import { CronJob } from 'cron';

import { config } from '../config.js';

export type TCronJobDef = {
  enabled: boolean;
  id: string;
  schedule: string;
  taskPath: string;
  timezone?: string;
};

export type TCronTickHandler = (job: TCronJobDef) => void | Promise<void>;

const activeJobs = new Map<string, CronJob>();

export const syncCronJobs = (
  defs: TCronJobDef[],
  onTick: TCronTickHandler,
) => {
  const nextIds = new Set(defs.filter((d) => d.enabled).map((d) => d.id));

  for (const [id, job] of activeJobs.entries()) {
    if (!nextIds.has(id)) {
      job.stop();
      activeJobs.delete(id);
    }
  }

  for (const def of defs) {
    if (!def.enabled) {
      continue;
    }

    if (activeJobs.has(def.id)) {
      continue;
    }

    const job = CronJob.from({
      cronTime: def.schedule,
      onTick: () => {
        void onTick(def);
      },
      start: true,
      timeZone: def.timezone,
    });

    activeJobs.set(def.id, job);
    console.log(`[worker][cron] registered ${def.id} ${def.schedule}`);
  }
};

export const fetchCronJobs = async (): Promise<TCronJobDef[]> => {
  const url = `${config.sessionApiBaseUrl}/api/platform/cron/jobs`;

  try {
    const res = await fetch(url);

    if (!res.ok) {
      return [];
    }

    const data = await res.json() as { items?: TCronJobDef[] };

    return data.items ?? [];
  } catch {
    return [];
  }
};

export const startCronScheduler = (onTick: TCronTickHandler) => {
  const refresh = async () => {
    const defs = await fetchCronJobs();
    syncCronJobs(defs, onTick);
  };

  void refresh();
  setInterval(() => {
    void refresh();
  }, config.cronRefreshMs);
};
