import path from 'node:path';

export const whatsappConfig = {
  authPath: process.env.WHATSAPP_AUTH_PATH?.trim() || path.join(
    process.env.WHATSAPP_DATA_ROOT?.trim() || '/whatsapp',
    'auth',
  ),
  enabled: process.env.WHATSAPP_ENABLED?.trim() === 'true',
  inboxRoot: process.env.WHATSAPP_INBOX_ROOT?.trim() || path.join(
    process.env.WHATSAPP_DATA_ROOT?.trim() || '/whatsapp',
    'inbox',
  ),
  whitelist: process.env.WHATSAPP_WHITELIST?.trim() || '',
};
