export const parseEmailWhitelist = (raw: string | undefined): string[] => {
  if (!raw?.trim()) {
    return [];
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const normalizeEmailRecipient = (value: string): string =>
  value.trim().toLowerCase();

export const recipientMatchesEmailWhitelist = (
  recipient: string,
  whitelist: string[],
): boolean => {
  const normalized = normalizeEmailRecipient(recipient);

  if (!normalized || whitelist.length === 0) {
    return false;
  }

  for (const entry of whitelist) {
    const allowed = normalizeEmailRecipient(entry);

    if (!allowed) {
      continue;
    }

    if (normalized === allowed) {
      return true;
    }
  }

  return false;
};
