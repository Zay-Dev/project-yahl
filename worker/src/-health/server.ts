import { config } from '../config.js';

let lastPollOkAt = Date.now();

export const isVerifyApiKeyConfigured = (apiKey: string) => Boolean(apiKey.trim());

export const resolveWorkerReady = (params: {
  agentCliReady: boolean;
  apiKey: string;
  pollFresh: boolean;
}) => isVerifyApiKeyConfigured(params.apiKey) && params.agentCliReady && params.pollFresh;

export const exitIfMissingApiKey = (
  apiKey: string,
  exit: (code: number) => never = process.exit,
) => {
  if (!isVerifyApiKeyConfigured(apiKey)) {
    console.error('[worker] fatal: CURSOR_API_KEY is required for verify; set it in .env');
    exit(1);
  }
};

export const markPollSucceeded = () => {
  lastPollOkAt = Date.now();
};

export const isWorkerReady = () => Date.now() - lastPollOkAt <= config.pollIntervalMs * 2;
