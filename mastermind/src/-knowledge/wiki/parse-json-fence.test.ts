import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isJsonFenceOnlyContent,
  parseJsonFenceFromContent,
} from './parse-json-fence.js';

describe('parse-json-fence', () => {
  it('parses fenced json body', () => {
    const parsed = parseJsonFenceFromContent('```json\n{"preferredName":"Alex"}\n```');

    assert.deepEqual(parsed, { preferredName: 'Alex' });
  });

  it('parses titled fenced json page', () => {
    const content = '# identity\n\n```json\n{"role":"builder"}\n```\n';
    const parsed = parseJsonFenceFromContent(content);

    assert.deepEqual(parsed, { role: 'builder' });
    assert.equal(isJsonFenceOnlyContent(content), true);
  });
});
