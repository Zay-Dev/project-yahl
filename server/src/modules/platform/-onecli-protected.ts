export const PROTECTED_ONECLI_SECRET_NAMES = ['Deepseek', 'KuaiPao AI'] as const;

const protectedSet = new Set<string>(PROTECTED_ONECLI_SECRET_NAMES);

export const isProtectedOneCliSecretName = (name: string) => protectedSet.has(name.trim());
