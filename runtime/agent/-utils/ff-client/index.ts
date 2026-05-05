import type { StageContextPayload } from "@/shared/stage-contract";

export const fastForward = async (
  _context: StageContextPayload
) => {
  const context = JSON.parse(JSON.stringify(_context));

  return context.context as Record<string, unknown>;
};