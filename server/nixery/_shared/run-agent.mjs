export const resolveDefId = (defRoot) =>
  process.env.NIXERY_DEF_ID?.trim() || defRoot.split('/').filter(Boolean).pop() || 'nixery';

export const logProgress = (defId, message) => {
  console.error(`[nixery-${defId}] ${message}`);
};

export const callChatWithLog = async (defId, round, fetchFn) => {
  const started = Date.now();

  logProgress(defId, `llm round=${round} start`);

  const result = await fetchFn();

  logProgress(defId, `llm round=${round} done ms=${Date.now() - started}`);

  return result;
};
