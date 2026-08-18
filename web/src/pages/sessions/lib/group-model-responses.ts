import type { TResponseStageModelResponseItem } from "@project-yahl/server/modules/sessions/-api-types";

const NIXERY_TAG_PREFIX = "nixery:";

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

export const groupModelResponsesByNixery = (
  responses: TResponseStageModelResponseItem[],
) => {
  const untagged: TResponseStageModelResponseItem[] = [];
  const byDef = new Map<string, TResponseStageModelResponseItem[]>();

  for (const response of responses) {
    const defId = nixeryDefIdFromTags(response.tags);

    if (!defId) {
      untagged.push(response);
      continue;
    }

    const list = byDef.get(defId) ?? [];

    list.push(response);
    byDef.set(defId, list);
  }

  const nixeryGroups = [...byDef.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([defId, items]) => ({
      defId,
      responses: items,
    }));

  return { nixeryGroups, untagged };
};
