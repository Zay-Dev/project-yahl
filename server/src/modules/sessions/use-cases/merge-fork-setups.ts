import type { TForkSessionStageSetup } from '../-types';
import type { TResponseStageReplayItem } from '../-api-types';

export const mergeForkSessionSetups = (
  replayRows: TResponseStageReplayItem[],
  anchorIndex: number,
  userSetups: TForkSessionStageSetup[],
): TForkSessionStageSetup[] => {
  const userByStageId = new Map(userSetups.map((setup) => [setup.stageId, setup]));
  const setups: TForkSessionStageSetup[] = [];

  for (let index = anchorIndex; index < replayRows.length; index += 1) {
    const row = replayRows[index]!;

    setups.push(
      userByStageId.get(row.stageId) ?? {
        context: row.context,
        loopMeta: row.loopMeta,
        stage: row.stage,
        stageId: row.stageId,
      },
    );
  }

  return setups;
};
