import type { TStorage } from "@/shared/transports/-types";

export const fastForward = async (
  _context: TStorage
) => {
  const context = JSON.parse(JSON.stringify(_context));

  return context.context as Record<string, unknown>;
};