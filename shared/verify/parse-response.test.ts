import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseVerifyResponse } from './parse-response.js';

describe('parseVerifyResponse', () => {
  it('parses pass response with score clamp', () => {
    const result = parseVerifyResponse({
      classifyResume: false,
      minScore: 0.75,
      text: '{"score":1.5,"pass":true,"feedback":"ok"}',
    });

    assert.equal(result.pass, true);
    assert.equal(result.score, 1);
    assert.equal(result.feedback, 'ok');
  });

  it('derives pass from minScore when pass omitted', () => {
    const result = parseVerifyResponse({
      classifyResume: false,
      minScore: 0.75,
      text: '{"score":0.8,"feedback":"good"}',
    });

    assert.equal(result.pass, true);
  });

  it('classifies resumeAction when verify resume enabled', () => {
    const result = parseVerifyResponse({
      classifyResume: true,
      minScore: 0.75,
      text: '{"score":0.2,"pass":false,"feedback":"bad","resumeAction":"edit_answer","askUserRef":"q1"}',
    });

    assert.equal(result.pass, false);
    assert.equal(result.resumeAction, 'edit_answer');
    assert.equal(result.askUserRef, 'q1');
  });
});
