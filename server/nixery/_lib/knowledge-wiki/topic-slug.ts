export const sanitizeSegment = (segment: string) =>
  segment.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'default';

export const normalizeTopicText = (text: string): string =>
  text.trim().toLowerCase().replace(/[^\w\s-]+/g, ' ').replace(/\s+/g, ' ').trim();

export const slugifyTopicText = (text: string, maxLen = 64): string => {
  const slug = sanitizeSegment(text.trim().toLowerCase().replace(/\s+/g, '-'));

  return slug.slice(0, maxLen) || 'general';
};

export const parseUrlSignals = (urls: string[]): { hosts: string[]; paths: string[] } => {
  const hosts = new Set<string>();
  const paths = new Set<string>();

  for (const raw of urls) {
    const trimmed = raw.trim();

    if (!trimmed) {
      continue;
    }

    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.replace(/^www\./, '');

      hosts.add(host);

      const normalizedPath = parsed.pathname.replace(/\/+$/, '') || '/';

      paths.add(normalizedPath.toLowerCase());
    } catch {
      // skip invalid URLs
    }
  }

  return {
    hosts: [...hosts].sort(),
    paths: [...paths].sort(),
  };
};

export const urlSignalsOverlap = (
  left: { hosts: string[]; paths: string[] },
  right: { hosts: string[]; paths: string[] },
): boolean => {
  if (!left.hosts.length || !right.hosts.length) {
    return false;
  }

  const sharedHosts = left.hosts.some((host) => right.hosts.includes(host));

  if (!sharedHosts) {
    return false;
  }

  if (!left.paths.length || !right.paths.length) {
    return true;
  }

  return left.paths.some((segment) => right.paths.some((other) =>
    segment.includes(other) || other.includes(segment)));
};
