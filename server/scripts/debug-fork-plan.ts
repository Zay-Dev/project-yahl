import mongoose from 'mongoose';

import '@/core';
import config from '@/config';

import { Queries } from '@omni-infra/mongoose';

import { ForkSessionManager } from '../../runtime/orchestrator/fork-session-manager';
import { modelForkSession } from '@/modules/sessions/models';
import { resolveSessionStagesReplay } from '@/modules/sessions/use-cases/stage-read';

const forkSessionId = process.argv[2]?.trim();

if (!forkSessionId) {
  console.error('Usage: tsx server/scripts/debug-fork-plan.ts <forkSessionId>');
  process.exit(1);
}

const _formatStep = (
  step: ReturnType<ForkSessionManager['buildExecutionPlan']>[number],
  index: number,
) => {
  if (step.kind === 'fastForward') {
    return {
      index,
      kind: step.kind,
      loopIndex: step.row.loopMeta?.index,
      requestId: step.row.requestId,
      hasContextAfter: Boolean(step.row.contextAfter),
      stageId: step.row.stageId,
    };
  }

  return {
    index,
    kind: step.kind,
    loopIndex: step.setup.loopMeta?.index,
    stageId: step.setup.stageId,
  };
};

const main = async () => {
  await mongoose.connect(config.mongoDb.url);

  const forkSession = await Queries.hasExactOne(modelForkSession, { forkSessionId });
  const sourceRows = await resolveSessionStagesReplay(forkSession.sourceSessionId);

  const manager = new ForkSessionManager(
    {
      anchorStageId: forkSession.anchorStageId,
      forkSessionId: forkSession.forkSessionId,
      setups: forkSession.setups,
      sourceSessionId: forkSession.sourceSessionId,
      targetSessionId: forkSession.targetSessionId,
    },
    sourceRows,
  );

  const anchorIndex = manager.getAnchorIndex();
  const plan = manager.buildExecutionPlan();

  console.log(JSON.stringify({
    anchorIndex,
    anchorStageId: forkSession.anchorStageId,
    forkSessionId,
    prefixCount: manager.getPrefixRows().length,
    runCount: manager.getSuffixSetups().length,
    sourceSessionId: forkSession.sourceSessionId,
    targetSessionId: forkSession.targetSessionId,
    steps: plan.map(_formatStep),
  }, null, 2));

  await mongoose.disconnect();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
