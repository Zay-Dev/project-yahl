import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  containsLegacyOneCliProxyHost,
  LEGACY_ONECLI_PROXY_HOST,
  ONECLI_PROXY_HOST,
  remapOneCliProxyHost,
  remapOneCliTransportEnv,
  redactProxyUrl,
  shouldApplyOneCliTransportValue,
} from './onecli-transport.js';

describe('remapOneCliProxyHost', () => {
  it('remaps host.docker.internal to onecli service name', () => {
    const input = `http://x:secret@${LEGACY_ONECLI_PROXY_HOST}`;

    assert.equal(
      remapOneCliProxyHost(input),
      `http://x:secret@${ONECLI_PROXY_HOST}`,
    );
  });
});

describe('remapOneCliTransportEnv', () => {
  it('remaps proxy keys in transport env records', () => {
    const remapped = remapOneCliTransportEnv({
      HTTPS_PROXY: `http://x:secret@${LEGACY_ONECLI_PROXY_HOST}`,
      NODE_USE_ENV_PROXY: '1',
    });

    assert.equal(remapped.HTTPS_PROXY, `http://x:secret@${ONECLI_PROXY_HOST}`);
    assert.equal(remapped.NODE_USE_ENV_PROXY, '1');
  });
});

describe('shouldApplyOneCliTransportValue', () => {
  it('applies when env is unset', () => {
    assert.equal(
      shouldApplyOneCliTransportValue('HTTPS_PROXY', '', `http://x@${LEGACY_ONECLI_PROXY_HOST}`),
      true,
    );
  });

  it('forces override when current env still uses host.docker.internal', () => {
    assert.equal(
      shouldApplyOneCliTransportValue(
        'HTTPS_PROXY',
        `http://x@${LEGACY_ONECLI_PROXY_HOST}`,
        `http://x@${ONECLI_PROXY_HOST}`,
      ),
      true,
    );
    assert.equal(containsLegacyOneCliProxyHost(`http://x@${LEGACY_ONECLI_PROXY_HOST}`), true);
  });

  it('skips non-proxy keys when env is already set', () => {
    assert.equal(
      shouldApplyOneCliTransportValue('NODE_USE_ENV_PROXY', '1', '1'),
      false,
    );
  });
});

describe('redactProxyUrl', () => {
  it('redacts credentials and returns direct for empty input', () => {
    assert.equal(redactProxyUrl(''), 'direct');
    assert.equal(
      redactProxyUrl(`http://user:pass@${ONECLI_PROXY_HOST}`),
      `http://${ONECLI_PROXY_HOST.split(':')[0]}:10255`,
    );
  });
});
