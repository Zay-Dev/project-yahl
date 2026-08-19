export const topicDomainKind = (topic: string): string | null => {
  const slug = topic.trim().toLowerCase();

  if (/(^|-)((public-)?holidays?)(\b|$)/.test(slug)) {
    return 'holidays';
  }

  if (/(^|-)weather(\b|$)/.test(slug)) {
    return 'weather';
  }

  if (/traffic|hkemobility/.test(slug)) {
    return 'traffic';
  }

  if (slug === 'notifications' || slug === 'platform' || slug.startsWith('platform-')) {
    return 'platform';
  }

  return null;
};

export const assertSameDomainMerge = (sourceTopic: string, targetTopic: string): void => {
  const sourceKind = topicDomainKind(sourceTopic);
  const targetKind = topicDomainKind(targetTopic);

  if (sourceKind && targetKind && sourceKind !== targetKind) {
    throw new Error(
      `merge-topic refused: cross-domain merge ${sourceTopic} (${sourceKind}) → ${targetTopic} (${targetKind})`,
    );
  }
};
