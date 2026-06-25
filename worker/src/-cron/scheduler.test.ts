import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  cronDefKey,
  resetCronSchedulerForTests,
  syncCronJobs,
  type TCronJobDef,
} from './scheduler.js';

const baseDef = (overrides: Partial<TCronJobDef> = {}): TCronJobDef => ({
  enabled: true,
  id: 'job-a',
  schedule: '0 3 * * *',
  taskPath: 'hk_weather',
  ...overrides,
});

describe('syncCronJobs', () => {
  it('logs created when a new enabled job appears', () => {
    resetCronSchedulerForTests();
    const logs: string[] = [];

    syncCronJobs([baseDef()], () => {}, {
      log: (message) => logs.push(message),
    });

    assert.equal(logs.some((line) => line.includes('[worker][cron] created job-a')), true);
  });

  it('logs updated when schedule changes', () => {
    resetCronSchedulerForTests();
    const logs: string[] = [];
    const log = (message: string) => logs.push(message);

    syncCronJobs([baseDef()], () => {}, { log });
    syncCronJobs([baseDef({ schedule: '0 4 * * *' })], () => {}, { log });

    assert.equal(logs.some((line) => line.includes('[worker][cron] updated job-a')), true);
  });

  it('logs disabled when job is turned off', () => {
    resetCronSchedulerForTests();
    const logs: string[] = [];
    const log = (message: string) => logs.push(message);

    syncCronJobs([baseDef()], () => {}, { log });
    syncCronJobs([baseDef({ enabled: false })], () => {}, { log });

    assert.equal(logs.some((line) => line.includes('[worker][cron] disabled job-a')), true);
  });

  it('logs deleted when job disappears from the list', () => {
    resetCronSchedulerForTests();
    const logs: string[] = [];
    const log = (message: string) => logs.push(message);

    syncCronJobs([baseDef()], () => {}, { log });
    syncCronJobs([], () => {}, { log });

    assert.equal(logs.some((line) => line.includes('[worker][cron] deleted job-a')), true);
  });
});

describe('cronDefKey', () => {
  it('changes when schedule, timezone, or taskPath changes', () => {
    const def = baseDef();

    assert.equal(cronDefKey(def), cronDefKey(baseDef()));
    assert.notEqual(cronDefKey(def), cronDefKey(baseDef({ schedule: '1 2 3 4 5' })));
    assert.notEqual(cronDefKey(def), cronDefKey(baseDef({ timezone: 'UTC' })));
    assert.notEqual(cronDefKey(def), cronDefKey(baseDef({ taskPath: 'research' })));
  });
});
