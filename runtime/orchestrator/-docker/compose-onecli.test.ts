import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildComposeDownArgs,
  buildComposeUpArgs,
} from '@/orchestrator/-docker/compose-onecli';
import { composeFile } from '@/orchestrator/-docker/paths';

describe('buildComposeUpArgs', () => {
  it('includes force-recreate for agent bring-up', () => {
    const args = buildComposeUpArgs({ composeProjectName: 'agent-sess-1' });

    assert.deepEqual(args, [
      '-f',
      composeFile,
      '-p',
      'agent-sess-1',
      'up',
      '-d',
      '--force-recreate',
      'agent',
    ]);
  });

  it('passes override files before project name', () => {
    const args = buildComposeUpArgs({
      composeOverrideFilePaths: ['/tmp/session.override.yml', '/tmp/onecli.override.yml'],
      composeProjectName: 'agent-sess-2',
    });

    assert.deepEqual(args, [
      '-f',
      composeFile,
      '-f',
      '/tmp/session.override.yml',
      '-f',
      '/tmp/onecli.override.yml',
      '-p',
      'agent-sess-2',
      'up',
      '-d',
      '--force-recreate',
      'agent',
    ]);
  });
});

describe('buildComposeDownArgs', () => {
  it('uses base compose file only when no overrides', () => {
    const args = buildComposeDownArgs({ composeProjectName: 'agent-sess-1' });

    assert.deepEqual(args, [
      '-f',
      composeFile,
      '-p',
      'agent-sess-1',
      'down',
      '--remove-orphans',
    ]);
  });

  it('includes override files when provided', () => {
    const args = buildComposeDownArgs({
      composeOverrideFilePaths: ['/tmp/session.override.yml'],
      composeProjectName: 'agent-sess-3',
    });

    assert.deepEqual(args, [
      '-f',
      composeFile,
      '-f',
      '/tmp/session.override.yml',
      '-p',
      'agent-sess-3',
      'down',
      '--remove-orphans',
    ]);
  });
});
