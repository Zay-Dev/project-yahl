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

type TCronSyncDeps = {
  log?: (message: string) => void;
};

const activeJobs = new Map<string, CronJob>();
const activeDefs = new Map<string, TCronJobDef>();

export const cronDefKey = (def: TCronJobDef) =>
  `${def.schedule}|${def.timezone ?? ''}|${def.taskPath}`;

const stopActiveJob = (id: string) => {
  const job = activeJobs.get(id);

  if (job) {
    job.stop();
  }

  activeJobs.delete(id);
  activeDefs.delete(id);
};

const registerJob = (def: TCronJobDef, onTick: TCronTickHandler) => {
  const job = CronJob.from({
    cronTime: def.schedule,
    onTick: () => {
      void onTick(def);
    },
    start: true,
    timeZone: def.timezone,
  });

  activeJobs.set(def.id, job);
  activeDefs.set(def.id, { ...def });
};

export const syncCronJobs = (
  defs: TCronJobDef[],
  onTick: TCronTickHandler,
  deps: TCronSyncDeps = {},
) => {
  const log = deps.log ?? ((message: string) => console.log(message));
  const defsById = new Map(defs.map((def) => [def.id, def]));

  for (const id of [...activeJobs.keys()]) {
    const def = defsById.get(id);

    if (!def) {
      stopActiveJob(id);
      log(`[worker][cron] deleted ${id}`);
      continue;
    }

    if (!def.enabled) {
      stopActiveJob(id);
      log(`[worker][cron] disabled ${id}`);
    }
  }

  for (const def of defs) {
    if (!def.enabled) {
      continue;
    }

    const current = activeDefs.get(def.id);

    if (current && cronDefKey(current) === cronDefKey(def)) {
      continue;
    }

    if (current) {
      stopActiveJob(def.id);
      log(`[worker][cron] updated ${def.id} ${def.schedule}`);
    } else {
      log(`[worker][cron] created ${def.id} ${def.schedule}`);
    }

    registerJob(def, onTick);
  }
};

export const fetchCronJobs = async (): Promise<TCronJobDef[]> => {
  const url = `${config.sessionApiBaseUrl}/api/platform/cron/jobs`;

  try {
    const res = await fetch(url);

    if (!res.ok) {
      return [];
    }

    const data = await res.json() as {
      data?: { items?: TCronJobDef[] };
      items?: TCronJobDef[];
    };
    const payload = data.data ?? data;

    return payload.items ?? [];
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

export const resetCronSchedulerForTests = () => {
  for (const id of [...activeJobs.keys()]) {
    stopActiveJob(id);
  }
};
