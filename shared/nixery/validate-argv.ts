const DOCKER_FLAG_TOKENS = new Set([
  '--mount',
  '--volume',
  '-v',
  '--network',
  '--privileged',
  '--cap-add',
  'docker',
  'compose',
]);

const SHELL_METACHAR_PATTERN = /[;|&$`]/;

const PATH_SEGMENT_PATTERN = /\.\./;

export const validateNixeryArgv = (argv: string[]): string | null => {
  if (!Array.isArray(argv) || argv.length === 0) {
    return 'argv must be a non-empty string array';
  }

  if (argv.some((token) => typeof token !== 'string' || !token.trim())) {
    return 'argv tokens must be non-empty strings';
  }

  for (const token of argv) {
    if (token.startsWith('--') && DOCKER_FLAG_TOKENS.has(token.split('=')[0]!)) {
      return `argv token not allowed: ${token}`;
    }

    if (token.startsWith('-v') || token === '-v') {
      return 'argv token not allowed: volume flag';
    }

    if (SHELL_METACHAR_PATTERN.test(token)) {
      return `argv token not allowed: ${token}`;
    }

    if (PATH_SEGMENT_PATTERN.test(token)) {
      return `argv token not allowed: ${token}`;
    }

    if (token.includes('\n')) {
      return 'argv tokens must not contain newlines';
    }
  }

  const executable = argv[0]!;

  if (executable.includes('/') || executable.startsWith('.')) {
    return 'argv executable must be a catalog binary name, not a path';
  }

  if (['sh', 'bash', 'zsh'].includes(executable) && argv[1] === '-c') {
    return 'shell -c is not allowed in v1';
  }

  return null;
};
