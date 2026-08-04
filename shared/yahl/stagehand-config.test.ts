import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { validateYahlStage } from './validate-stage';

describe('validateYahlStage stagehand', () => {
  it('accepts optional stagehand config', () => {
    const stage = validateYahlStage({
      logic: 'const x = 1;',
      stagehand: {
        apiBaseUrl: 'https://api.example.com',
        model: 'deepseek-v4-flash',
        preferScreenshot: true,
      },
    });

    assert.deepEqual(stage.stagehand, {
      apiBaseUrl: 'https://api.example.com',
      model: 'deepseek-v4-flash',
      preferScreenshot: true,
    });
  });

  it('accepts empty stagehand object', () => {
    const stage = validateYahlStage({
      logic: 'const x = 1;',
      stagehand: {},
    });

    assert.deepEqual(stage.stagehand, {});
  });

  it('rejects unknown stagehand keys', () => {
    assert.throws(
      () => validateYahlStage({
        logic: 'const x = 1;',
        stagehand: { apiKey: 'secret' },
      }),
      /unknown key/,
    );
  });

  it('rejects empty model', () => {
    assert.throws(
      () => validateYahlStage({
        logic: 'const x = 1;',
        stagehand: { model: '   ' },
      }),
      /stagehand\.model/,
    );
  });

  it('rejects non-boolean preferScreenshot', () => {
    assert.throws(
      () => validateYahlStage({
        logic: 'const x = 1;',
        stagehand: { preferScreenshot: 'yes' },
      }),
      /preferScreenshot/,
    );
  });
});
