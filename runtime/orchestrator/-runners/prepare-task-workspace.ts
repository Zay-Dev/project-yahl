import type { TSessionFetch } from '@/orchestrator/-ask-user/session-api';

import { sessionReferencesTaskSkills } from '@project-yahl/shared/yahl/session-references-task-skills';

import { fetchSession } from '@/orchestrator/-ask-user';
import {
  echoTaskSkillsToSession,
  verifyTaskSkillsMount,
} from '@/orchestrator/-utils/workspace-paths';

export type TSessionForTaskWorkspace = Pick<
  TSessionFetch,
  'parsedStages' | 'taskId' | 'taskSkills' | 'taskYahl'
>;

export { sessionReferencesTaskSkills };

export const assertSessionBundle = (session: TSessionFetch) => {
  if (!session.taskId.trim() || !session.taskYahl.trim()) {
    throw new Error(
      `[orchestrator] session missing task bundle sessionId=${session.sessionId}`,
    );
  }
};

export const prepareTaskWorkspace = async (sessionId: string) => {
  const session = await fetchSession(sessionId);

  assertSessionBundle(session);

  const needsSkills = sessionReferencesTaskSkills(session);
  const files = session.taskSkills;

  if (needsSkills && !files.length) {
    throw new Error(
      `[orchestrator] task references ~/task-skills/ but session has no taskSkills snapshot `
      + `sessionId=${sessionId}`,
    );
  }

  const echoed = await echoTaskSkillsToSession(sessionId, files);

  if (needsSkills) {
    if (!echoed.echoed) {
      throw new Error(
        `[orchestrator] task-skills echo failed sessionId=${sessionId} target=${echoed.target}`,
      );
    }

    const verified = await verifyTaskSkillsMount(echoed.target);

    if (!verified) {
      throw new Error(
        `[orchestrator] task-skills echo incomplete sessionId=${sessionId} target=${echoed.target}`,
      );
    }
  }

  return { session };
};
