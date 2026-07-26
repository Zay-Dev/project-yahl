import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { wrapVmLogic } from '../../condition-branch';
import { runScript } from './index';

const emptyStorage = () => ({
  context: new Map<string, unknown>(),
  types: new Map<string, unknown>(),
});

describe('runScript', () => {
  it('completes UTC+8 HKT calendar day under the VM budget', async () => {
    const logic = `
const started_at = new Date().toISOString();
const y = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
(() => ({
  started_at,
  fetches: [],
  prev_routes: [],
  summary_notified: false,
  notifications: [],
  day_page: \`raw/fetches-\${y}\`,
}))
`;

    const output = await runScript(wrapVmLogic(logic), emptyStorage());

    assert.equal(typeof output.started_at, 'string');
    assert.match(String(output.day_page), /^raw\/fetches-\d{4}-\d{2}-\d{2}$/);
    assert.deepEqual(output.fetches, []);
    assert.deepEqual(output.prev_routes, []);
    assert.equal(output.summary_notified, false);
    assert.deepEqual(output.notifications, []);
  });

  it('allows Intl Asia/Hong_Kong under the 1000ms VM timeout', async () => {
    const logic = `
const started_at = new Date().toISOString();
const y = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Hong_Kong',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
(() => ({ started_at, day_page: \`raw/fetches-\${y}\` }))
`;

    const output = await runScript(wrapVmLogic(logic), emptyStorage());

    assert.equal(typeof output.started_at, 'string');
    assert.match(String(output.day_page), /^raw\/fetches-\d{4}-\d{2}-\d{2}$/);
  });
});
