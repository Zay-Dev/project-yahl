import mongoose from 'mongoose';

import '@/core';
import config from '@/config';

import { resolveSessionStagesReplay } from '@/modules/sessions/use-cases/stage-read';

const sessionId = process.argv[2]?.trim();

if (!sessionId) {
  console.error('Usage: tsx server/scripts/debug-fork-replay.ts <sessionId>');
  process.exit(1);
}

const main = async () => {
  await mongoose.connect(config.mongoDb.url);

  const rows = await resolveSessionStagesReplay(sessionId);

  console.log(JSON.stringify(rows.map((row, index) => ({
    contextAfter: Boolean(row.contextAfter),
    index,
    loopIndex: row.loopMeta?.index,
    requestId: row.requestId,
    stageId: row.stageId,
    stageLogic: typeof row.stage?.logic === 'string'
      ? row.stage.logic.slice(0, 80)
      : undefined,
  })), null, 2));

  await mongoose.disconnect();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
