export const OBSERVATION_INBOX_TOPIC = 'inbox';

export type TObservationTopicSignals = {
  claim?: string;
  cue?: string;
  example?: string;
  quote?: string;
  tags?: string[];
  topicHint?: string;
};

export const resolveObservationTargetTopic = (
  signals: TObservationTopicSignals,
  inboxTopic: string,
): string => {
  const hint = signals.topicHint?.trim();

  if (hint && hint !== OBSERVATION_INBOX_TOPIC) {
    return hint;
  }

  return inboxTopic.trim() || OBSERVATION_INBOX_TOPIC;
};
