import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LOOKUP_OUTPUT,
  buildLookupPrompt,
} from './error-knowledge-lookup-prompt.mjs';

describe('buildLookupPrompt', () => {
  it('injects candidates and treats topic_hint as filing only', () => {
    const prompt = buildLookupPrompt({
      candidates: [{
        path: 'topics/platform/facts.md',
        excerpt: 'propose-notification accepts exactly {channel, to, direction, body}',
      }],
      excludedPath: 'topics/platform-notifications/raw/observations/2026-08-18/error-4f94cea86e13',
      failure: {
        tool: 'platform/propose-notification',
        topicHint: 'platform-notifications',
        cue: 'propose-notification returned ok:false Error',
      },
    });

    assert.match(prompt, /topics\/platform\/facts\.md/);
    assert.match(prompt, /channel, to, direction, body/);
    assert.match(prompt, /topic_hint is filing metadata only/);
    assert.match(prompt, /never use it as the search root/);
    assert.match(prompt, /Do not start by listing the topic_hint directory/);
    assert.match(prompt, new RegExp(LOOKUP_OUTPUT));
    assert.match(prompt, /error-4f94cea86e13/);
  });

  it('tells the agent to grep the corpus when candidates are empty', () => {
    const prompt = buildLookupPrompt({
      candidates: [],
      excludedPath: 'topics/inbox/raw/observations/x',
      failure: { tool: 'browser' },
    });

    assert.match(prompt, /Corpus grep found no candidates/);
    assert.match(prompt, /grep -R the whole \/data\/knowledge_export/);
    assert.match(prompt, /no pipes, no find/);
    assert.doesNotMatch(prompt, /Candidates:\n\[/);
  });
});
