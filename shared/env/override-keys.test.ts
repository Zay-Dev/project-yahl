import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  buildInitialOverrideContent,
  hashOverrideValues,
  statEnvOverridePath,
  stripUnlistedOverrideKeys,
} from './override-keys.ts';

describe('stripUnlistedOverrideKeys', () => {
  it('drops unknown keys and keeps comments plus allowed assignments', () => {
    const raw = [
      '# tenant overrides',
      'WHATSAPP_ENABLED=true',
      'LLM_MODEL=should-not-stay',
      'EMAIL_WHITELIST=ops@example.com',
      '',
    ].join('\n');
    const result = stripUnlistedOverrideKeys(raw);

    assert.deepEqual(result.droppedKeys, ['LLM_MODEL']);
    assert.equal(result.values.WHATSAPP_ENABLED, 'true');
    assert.equal(result.values.EMAIL_WHITELIST, 'ops@example.com');
    assert.equal(result.content.includes('LLM_MODEL'), false);
    assert.equal(result.content.includes('# tenant overrides'), true);
    assert.equal(result.content.includes('WHATSAPP_ENABLED=true'), true);
  });
});

describe('hashOverrideValues', () => {
  it('changes when a listed key changes', () => {
    const before = hashOverrideValues({ WHATSAPP_ENABLED: 'true' });
    const after = hashOverrideValues({ WHATSAPP_ENABLED: 'false' });
    const same = hashOverrideValues({ WHATSAPP_ENABLED: 'true' });

    assert.notEqual(before, after);
    assert.equal(before, same);
  });
});

describe('statEnvOverridePath', () => {
  it('distinguishes missing, file, and directory', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-override-'));
    const filePath = path.join(dir, 'file');
    const missingPath = path.join(dir, 'missing');

    fs.writeFileSync(filePath, '');

    assert.equal(statEnvOverridePath(filePath), 'file');
    assert.equal(statEnvOverridePath(dir), 'directory');
    assert.equal(statEnvOverridePath(missingPath), 'missing');
  });
});

describe('buildInitialOverrideContent', () => {
  it('prefers .env over .env.example and uses commented example when .env omits the key', () => {
    const envRaw = [
      'WHATSAPP_ENABLED=false',
      'LLM_MODEL=ignored',
      'SMTP_HOST=from-env.example.com',
    ].join('\n');
    const exampleRaw = [
      '# SMTP_HOST=smtp.gmail.com',
      '# SMTP_PORT=587',
      'WHATSAPP_ENABLED=true',
    ].join('\n');
    const content = buildInitialOverrideContent(envRaw, exampleRaw);

    assert.equal(content.includes('LLM_MODEL'), false);
    assert.match(content, /^WHATSAPP_ENABLED=false$/m);
    assert.match(content, /^SMTP_HOST=from-env.example.com$/m);
    assert.match(content, /^SMTP_PORT=587$/m);
    assert.match(content, /^SMTP_PASS=$/m);
  });
});
