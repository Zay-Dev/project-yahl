import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  OBSERVATION_INBOX_TOPIC,
  resolveObservationTargetTopic,
} from './observation-topic.js';

describe('resolveObservationTargetTopic', () => {
  it('rehomes when topic_hint differs from managed topic', () => {
    const topic = resolveObservationTargetTopic({
      claim: 'propose-notification needs direction to_user and body',
      cue: 'WhatsApp propose-notification',
      example: 'succeeded after adding direction',
      topicHint: 'notifications',
      tags: ['HOWTO', 'TRICK'],
    }, 'traffic-monitor');

    assert.equal(topic, 'notifications');
  });

  it('keeps domain hint under managed topic', () => {
    const topic = resolveObservationTargetTopic({
      claim: 'Origin Court binds via Main Street',
      cue: 'PLACE OD bind',
      tags: ['PLACE'],
      topicHint: 'traffic-monitor',
    }, 'traffic-monitor');

    assert.equal(topic, 'traffic-monitor');
  });

  it('falls back to inbox when hint missing', () => {
    const topic = resolveObservationTargetTopic({
      claim: 'generic tip',
      cue: 'ops',
    }, OBSERVATION_INBOX_TOPIC);

    assert.equal(topic, OBSERVATION_INBOX_TOPIC);
  });

  it('does not override wrong domain hint from content alone', () => {
    const topic = resolveObservationTargetTopic({
      claim: 'propose-notification needs direction to_user and body',
      cue: 'WhatsApp propose-notification',
      topicHint: 'traffic-monitor',
      tags: ['HOWTO'],
    }, 'traffic-monitor');

    assert.equal(topic, 'traffic-monitor');
  });
});
