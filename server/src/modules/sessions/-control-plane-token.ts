import fs from 'fs';

export const normalizeControlPlaneToken = (value: string) => value.replace(/\s+/g, '');

export const resolveControlPlaneServiceToken = () => {
  const fromEnv = process.env.CONTROL_PLANE_SERVICE_TOKEN ?? '';

  if (fromEnv.trim()) {
    return normalizeControlPlaneToken(fromEnv);
  }

  const tokenFile = process.env.CONTROL_PLANE_SERVICE_TOKEN_FILE?.trim() ?? '';

  if (!tokenFile || !fs.existsSync(tokenFile)) {
    return '';
  }

  return normalizeControlPlaneToken(fs.readFileSync(tokenFile, 'utf8'));
};

export const assertControlPlaneServiceToken = (headerValue: string | string[] | undefined): void => {
  const expected = resolveControlPlaneServiceToken();
  const provided = typeof headerValue === 'string'
    ? normalizeControlPlaneToken(headerValue)
    : '';

  if (!expected || provided !== expected) {
    throw errors.custom('invalid control plane token', 401);
  }
};
