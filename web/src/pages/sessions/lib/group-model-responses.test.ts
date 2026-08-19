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

const sectionIds = (sections: ReturnType<typeof groupModelResponsesByNixery>) =>
  sections.map((section) => [
    section.kind === "nixery" ? `nixery:${section.defId}` : "agent",
    section.responses.map((item) => item._id),
  ]);

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
  it("places nixery between agent calls in createdAt order", () => {
    const sections = groupModelResponsesByNixery([
      response({
        _id: "agent-1",
        createdAt: "2026-08-19T15:46:00.000Z",
        tags: ["chat"],
      }),
      response({
        _id: "nixery-1",
        createdAt: "2026-08-19T15:47:39.000Z",
        tags: ["tool", "nixery:resolve-error-with-knowledge"],
      }),
      response({
        _id: "agent-2",
        createdAt: "2026-08-19T15:48:53.000Z",
        tags: ["bash"],
      }),
    ]);

    assert.deepEqual(sectionIds(sections), [
      ["agent", ["agent-1"]],
      ["nixery:resolve-error-with-knowledge", ["nixery-1"]],
      ["agent", ["agent-2"]],
    ]);
  });

  it("keeps non-adjacent same-def nixery calls as separate sections", () => {
    const sections = groupModelResponsesByNixery([
      response({
        _id: "nixery-1",
        createdAt: "2026-08-19T15:47:00.000Z",
        tags: ["tool", "nixery:resolve-error-with-knowledge"],
      }),
      response({
        _id: "agent-1",
        createdAt: "2026-08-19T15:48:00.000Z",
        tags: ["chat"],
      }),
      response({
        _id: "nixery-2",
        createdAt: "2026-08-19T15:49:00.000Z",
        tags: ["bash", "nixery:resolve-error-with-knowledge"],
      }),
    ]);

    assert.deepEqual(sectionIds(sections), [
      ["nixery:resolve-error-with-knowledge", ["nixery-1"]],
      ["agent", ["agent-1"]],
      ["nixery:resolve-error-with-knowledge", ["nixery-2"]],
    ]);
  });

  it("groups adjacent same-def nixery calls", () => {
    const sections = groupModelResponsesByNixery([
      response({
        _id: "a",
        createdAt: "2026-08-19T15:46:00.000Z",
        tags: ["chat"],
      }),
      response({
        _id: "b",
        createdAt: "2026-08-19T15:47:00.000Z",
        tags: ["tool", "nixery:resolve-error-with-knowledge"],
      }),
      response({
        _id: "c",
        createdAt: "2026-08-19T15:47:30.000Z",
        tags: ["bash", "nixery:resolve-error-with-knowledge"],
      }),
      response({
        _id: "d",
        createdAt: "2026-08-19T15:48:00.000Z",
        tags: ["tool", "nixery:append-raw-knowledge-page"],
      }),
    ]);

    assert.deepEqual(sectionIds(sections), [
      ["agent", ["a"]],
      ["nixery:resolve-error-with-knowledge", ["b", "c"]],
      ["nixery:append-raw-knowledge-page", ["d"]],
    ]);
  });

  it("sorts out-of-order input by createdAt then _id", () => {
    const sections = groupModelResponsesByNixery([
      response({
        _id: "agent-2",
        createdAt: "2026-08-19T15:48:53.000Z",
        tags: ["bash"],
      }),
      response({
        _id: "nixery-1",
        createdAt: "2026-08-19T15:47:39.000Z",
        tags: ["tool", "nixery:resolve-error-with-knowledge"],
      }),
      response({
        _id: "agent-1",
        createdAt: "2026-08-19T15:46:00.000Z",
        tags: ["chat"],
      }),
    ]);

    assert.deepEqual(sectionIds(sections), [
      ["agent", ["agent-1"]],
      ["nixery:resolve-error-with-knowledge", ["nixery-1"]],
      ["agent", ["agent-2"]],
    ]);
  });
});
