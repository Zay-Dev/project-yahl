import { config } from '../config.js';

let lastPollOkAt = Date.now();

export const markPollSucceeded = () => {
  lastPollOkAt = Date.now();
};

export const isPollFresh = () => Date.now() - lastPollOkAt <= config.pollIntervalMs * 2;
