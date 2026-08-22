import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  parseScriptMeta,
  scriptGoalMet,
  validateScriptOutput,
} from './contract';

describe('knowledge-to-script contract', () => {
  it('parses valid script meta', () => {
    const meta = parseScriptMeta({
      kind: 'recipe',
      outputSchema: 'TTrafficFetch.routes',
      scriptId: 'extract-routes',
      sourceKeys: ['source_ops_md', 'traffic_source'],
    });

    assert.deepEqual(meta, {
      kind: 'recipe',
      outputSchema: 'TTrafficFetch.routes',
      scriptId: 'extract-routes',
      sourceKeys: ['source_ops_md', 'traffic_source'],
    });
  });

  it('rejects invalid script meta', () => {
    assert.equal(parseScriptMeta({ scriptId: '9bad' }), null);
    assert.equal(parseScriptMeta(null), null);
  });

  it('validates script output against required fields', () => {
    assert.equal(
      validateScriptOutput({ routes: [] }, { requiredFields: ['routes'] }),
      true,
    );
    assert.equal(
      validateScriptOutput({}, { requiredFields: ['routes'] }),
      false,
    );
    assert.equal(scriptGoalMet({ ok: true }, {}), true);
  });
});
