import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseTaskMetadata } from './-parse-task-metadata';

describe('parseTaskMetadata', () => {
  it('reads name and description from yahl front matter', () => {
    const metadata = parseTaskMetadata(`name: Demo task
description: Does a thing

stages:
  - logic: |
      (() => ({}))`);

    assert.deepEqual(metadata, {
      description: 'Does a thing',
      name: 'Demo task',
    });
  });
});
