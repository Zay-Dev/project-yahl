export type TSendResult = {
  error?: string;
  ok: boolean;
};

export const sendEmail = async (params: {
  body: string;
  fromIdentity?: string;
  to: string;
}): Promise<TSendResult> => {
  const host = process.env.SMTP_HOST?.trim();

  if (!host) {
    console.log('[worker][email:stub]', params.to, params.body.slice(0, 120));
    return { ok: true };
  }

  // v1: log-only unless SMTP configured
  console.log('[worker][email]', params.fromIdentity ?? 'default', '→', params.to);
  return { ok: true };
};

export const sendWhatsApp = async (params: {
  body: string;
  fromIdentity?: string;
  to: string;
}): Promise<TSendResult> => {
  const token = process.env.WHATSAPP_API_TOKEN?.trim();

  if (!token) {
    console.log('[worker][whatsapp:stub]', params.to, params.body.slice(0, 120));
    return { ok: true };
  }

  console.log('[worker][whatsapp]', params.fromIdentity ?? 'default', '→', params.to);
  return { ok: true };
};
