import type { Run } from '@cursor/sdk';

import { config } from '../config.js';

export const logRunStreamIfEnabled = async (run: Run): Promise<void> => {
  if (!config.sdkStreamLog) {
    return;
  }

  if (!run.supports('stream')) {
    return;
  }

  for await (const event of run.stream()) {
    console.log(
      '[mastermind][sdk-stream]',
      JSON.stringify(event, null, 2),
    );
  }
};
