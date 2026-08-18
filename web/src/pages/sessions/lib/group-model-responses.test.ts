import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TResponseStageModelResponseItem } from "@project-yahl/server/modules/sessions/-api-types";

import {
  groupModelResponsesByNixery,
  nixeryDefIdFromTags,
} from "./group-model-responses";

const response = (
  overrides: Partial<TResponseStageModelResponseItem>,
): TResponseStageModelResponseItem => ({
  _id: "1",
  contentPreview: "",
  createdAt: "2026-08-19T01:00:00.000Z",
  usage: null,
  ...overrides,
});

describe("nixeryDefIdFromTags", () => {
  it("reads the first nixery def id", () => {
    assert.equal(
      nixeryDefIdFromTags(["bash", "nixery:resolve-error-with-knowledge"]),
      "resolve-error-with-knowledge",
    );
  });

  it("returns null when tags have no nixery def", () => {
    assert.equal(nixeryDefIdFromTags(["bash", "tool"]), null);
    assert.equal(nixeryDefIdFromTags(["nixery:"]), null);
    assert.equal(nixeryDefIdFromTags(undefined), null);
  });
});

describe("groupModelResponsesByNixery", () => {
  it("keeps untagged responses in the default list and groups by def", () => {
    const grouped = groupModelResponsesByNixery([
      response({ _id: "a", tags: ["chat"] }),
      response({ _id: "b", tags: ["tool", "nixery:resolve-error-with-knowledge"] }),
      response({ _id: "c", tags: ["bash", "nixery:resolve-error-with-knowledge"] }),
      response({ _id: "d", tags: ["tool", "nixery:append-raw-knowledge-page"] }),
    ]);

    assert.deepEqual(
      grouped.untagged.map((item) => item._id),
      ["a"],
    );
    assert.deepEqual(
      grouped.nixeryGroups.map((group) => [
        group.defId,
        group.responses.map((item) => item._id),
      ]),
      [
        ["append-raw-knowledge-page", ["d"]],
        ["resolve-error-with-knowledge", ["b", "c"]],
      ],
    );
  });
});
