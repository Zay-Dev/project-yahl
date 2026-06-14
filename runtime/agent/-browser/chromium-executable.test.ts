import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveChromiumExecutablePath } from "./chromium-executable";

describe("resolveChromiumExecutablePath", () => {
  it("prefers CHROME_PATH when set", () => {
    const previous = process.env.CHROME_PATH;

    process.env.CHROME_PATH = "/custom/chrome";

    try {
      assert.equal(resolveChromiumExecutablePath(), "/custom/chrome");
    } finally {
      if (previous === undefined) delete process.env.CHROME_PATH;
      else process.env.CHROME_PATH = previous;
    }
  });

  it("uses STAGEHAND_CHROME_PATH when CHROME_PATH is unset", () => {
    const previousChrome = process.env.CHROME_PATH;
    const previousStagehand = process.env.STAGEHAND_CHROME_PATH;

    delete process.env.CHROME_PATH;
    process.env.STAGEHAND_CHROME_PATH = "/baked/chrome";

    try {
      assert.equal(resolveChromiumExecutablePath(), "/baked/chrome");
      assert.equal(process.env.CHROME_PATH, "/baked/chrome");
    } finally {
      if (previousChrome === undefined) delete process.env.CHROME_PATH;
      else process.env.CHROME_PATH = previousChrome;
      if (previousStagehand === undefined) delete process.env.STAGEHAND_CHROME_PATH;
      else process.env.STAGEHAND_CHROME_PATH = previousStagehand;
    }
  });

  it("falls back to playwright chromium executable", () => {
    const previous = process.env.CHROME_PATH;

    delete process.env.CHROME_PATH;

    try {
      const path = resolveChromiumExecutablePath();

      assert.match(path, /chrome|chromium/i);
    } finally {
      if (previous === undefined) delete process.env.CHROME_PATH;
      else process.env.CHROME_PATH = previous;
    }
  });
});
