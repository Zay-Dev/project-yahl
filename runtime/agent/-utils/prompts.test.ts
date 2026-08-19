import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { listReadableUtf8Files, readFolderUtf8 } from "./prompts";

describe("readFolderUtf8", () => {
  let dir = "";

  after(async () => {
    if (dir) {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it("includes real files and readable symlink targets, skips dirs and dangling links", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "yahl-prompts-"));
    const nested = path.join(dir, "nested");
    const target = path.join(dir, "knowledge-persist.md");
    const linked = path.join(dir, "linked-persist.md");
    const dangling = path.join(dir, "dangling.md");
    const real = path.join(dir, "prompt.md");

    await mkdir(nested);
    await writeFile(real, "# prompt\n");
    await writeFile(target, "# persist\n");
    await writeFile(path.join(nested, "skip.md"), "# nested\n");
    await symlink(path.relative(dir, target), linked);
    await symlink("missing-target.md", dangling);

    const files = await listReadableUtf8Files(dir);

    assert.deepEqual(
      files.map((file) => path.basename(file)),
      ["knowledge-persist.md", "linked-persist.md", "prompt.md"],
    );

    const content = await readFolderUtf8(dir);

    assert.match(content, /# persist/);
    assert.match(content, /# prompt/);
    assert.doesNotMatch(content, /# nested/);
  });
});
