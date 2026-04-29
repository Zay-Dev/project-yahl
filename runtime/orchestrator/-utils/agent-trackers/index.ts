import type { StageTokenTrace } from '@/shared/transport';

const _trackers = new Array();

export type TAgentTracker = {
  track: (event: StageTokenTrace) => void;
  reset: () => void;
}

export const add = (tracker: TAgentTracker) => {
  _trackers.push(tracker);
};

export const reset = () => {
  _trackers.forEach(tracker => tracker.reset());
};

export const track = (event: StageTokenTrace) => {
  _trackers.forEach(tracker => tracker.track(event));
};