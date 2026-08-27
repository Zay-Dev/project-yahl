import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  resolveCdpHttpUrl,
  rewriteCdpWebSocketHost,
} from './stagehand-session';

describe('stagehand CDP attach helpers', () => {
  it('reads YAHL_BROWSER_CDP_URL', () => {
    const previous = process.env.YAHL_BROWSER_CDP_URL;
    process.env.YAHL_BROWSER_CDP_URL = 'http://browser-sess:9222';

    try {
      assert.equal(resolveCdpHttpUrl(), 'http://browser-sess:9222');
    } finally {
      if (previous === undefined) {
        delete process.env.YAHL_BROWSER_CDP_URL;
      } else {
        process.env.YAHL_BROWSER_CDP_URL = previous;
      }
    }
  });

  it('rewrites websocket host and port to the CDP HTTP endpoint', () => {
    assert.equal(
      rewriteCdpWebSocketHost(
        'ws://127.0.0.1/devtools/browser/abc',
        'http://172.20.0.11:9222',
      ),
      'ws://172.20.0.11:9222/devtools/browser/abc',
    );
  });
});
