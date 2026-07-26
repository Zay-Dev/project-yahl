const stripToDigits = (value: string): string => value.replace(/\D/g, '');

export const parseWhatsAppWhitelist = (raw: string | undefined): string[] => {
  if (!raw?.trim()) {
    return [];
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const normalizeWhatsAppRecipient = (value: string): string => {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  if (trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }

  return stripToDigits(trimmed);
};

export const recipientMatchesWhatsAppWhitelist = (
  recipient: string,
  whitelist: string[],
): boolean => {
  const normalized = normalizeWhatsAppRecipient(recipient);

  if (!normalized || whitelist.length === 0) {
    return false;
  }

  for (const entry of whitelist) {
    const allowed = normalizeWhatsAppRecipient(entry);

    if (!allowed) {
      continue;
    }

    if (normalized === allowed) {
      return true;
    }

    if (normalized.includes('@') && allowed.includes('@') && normalized === allowed) {
      return true;
    }

    const recipientDigits = stripToDigits(normalized.split('@')[0] ?? '');
    const allowedDigits = stripToDigits(allowed.split('@')[0] ?? '');

    if (!recipientDigits || !allowedDigits) {
      continue;
    }

    if (
      recipientDigits === allowedDigits
      || recipientDigits.endsWith(allowedDigits)
      || allowedDigits.endsWith(recipientDigits)
    ) {
      return true;
    }
  }

  return false;
};

export const whatsAppChatIdsMatch = (left: string, right: string): boolean =>
  recipientMatchesWhatsAppWhitelist(left, [right]);

export const toWhatsAppChatId = (recipient: string): string => {
  const trimmed = recipient.trim();

  if (trimmed.includes('@')) {
    return trimmed;
  }

  const digits = stripToDigits(trimmed);

  return digits ? `${digits}@c.us` : '';
};

export const sanitizeWhatsAppFolder = (chatId: string): string => {
  const raw = chatId.trim().toLowerCase() || 'unknown';

  return raw.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
};
