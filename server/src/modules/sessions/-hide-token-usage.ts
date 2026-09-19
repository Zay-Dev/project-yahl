export const hideTokenUsage = () => {
  const raw = process.env.HIDE_TOKEN_USAGE?.trim().toLowerCase();

  return raw === '1' || raw === 'true';
};
