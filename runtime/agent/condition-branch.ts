export const isVmConditionBranch = (logic: string) => {
  const trimmed = logic.trim();

  if (trimmed.startsWith('(()') || trimmed.startsWith('{')) {
    return true;
  }

  if (/^const\s+/m.test(trimmed)) {
    return true;
  }

  return false;
};

export const wrapVmLogic = (logic: string) => {
  const trimmed = logic.trim();

  if (trimmed.startsWith('{')) {
    return trimmed;
  }

  return `{\n${trimmed}\n}`;
};
