import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { startStageWaitHeartbeat } from './stage-wait-heartbeat';

describe('startStageWaitHeartbeat', () => {
  it('fires on interval and clears', () => {
    mock.timers.enable({ apis: ['setInterval'] });

    const logs: string[] = [];
    let elapsedMs = 0;

    const heartbeat = startStageWaitHeartbeat({
      getElapsedMs: () => elapsedMs,
      intervalMs: 60_000,
      log: (...args) => logs.push(args.join(' ')),
      requestId: 'req-heartbeat',
      sessionId: 'sess-heartbeat',
      stageId: 'monitor',
      stageIndex: 11,
    });

    assert.equal(logs.length, 0);

    elapsedMs = 60_000;
    mock.timers.tick(60_000);

    assert.equal(logs.length, 1);
    assert.match(logs[0], /stage wait heartbeat requestId=req-heartbeat/);
    assert.match(logs[0], /elapsedMs=60000/);
    assert.match(logs[0], /stageIndex=11/);

    heartbeat.clear();

    elapsedMs = 120_000;
    mock.timers.tick(60_000);

    assert.equal(logs.length, 1);

    mock.timers.reset();
  });
});
