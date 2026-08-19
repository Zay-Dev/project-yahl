import type { TResponseStageModelResponseItem } from "@project-yahl/server/modules/sessions/-api-types";

const NIXERY_TAG_PREFIX = "nixery:";

export type TModelResponseSection =
  | { kind: "agent"; responses: TResponseStageModelResponseItem[] }
  | { kind: "nixery"; defId: string; responses: TResponseStageModelResponseItem[] };

export const nixeryDefIdFromTags = (tags: unknown): string | null => {
  if (!Array.isArray(tags)) {
    return null;
  }

  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    if (!tag.startsWith(NIXERY_TAG_PREFIX)) continue;

    const defId = tag.slice(NIXERY_TAG_PREFIX.length).trim();

    if (defId) {
      return defId;
    }
  }

  return null;
};

const compareByCreatedAt = (
  left: TResponseStageModelResponseItem,
  right: TResponseStageModelResponseItem,
) => {
  const byTime = left.createdAt.localeCompare(right.createdAt);

  if (byTime !== 0) {
    return byTime;
  }

  return left._id.localeCompare(right._id);
};

export const groupModelResponsesByNixery = (
  responses: TResponseStageModelResponseItem[],
): TModelResponseSection[] => {
  const ordered = [...responses].sort(compareByCreatedAt);
  const sections: TModelResponseSection[] = [];

  for (const response of ordered) {
    const defId = nixeryDefIdFromTags(response.tags);
    const last = sections.at(-1);

    if (defId) {
      if (last?.kind === "nixery" && last.defId === defId) {
        last.responses.push(response);
        continue;
      }

      sections.push({ kind: "nixery", defId, responses: [response] });
      continue;
    }

    if (last?.kind === "agent") {
      last.responses.push(response);
      continue;
    }

    sections.push({ kind: "agent", responses: [response] });
  }

  return sections;
};
