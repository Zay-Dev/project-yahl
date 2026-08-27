import { composeDown, resolveAgentComposeOverrideFiles } from './compose-agent';

export const shutdownAgent = async (agentName: string, sessionId: string) => {
  const composeOverrideFilePaths = await resolveAgentComposeOverrideFiles(sessionId);

  await composeDown({
    composeOverrideFilePaths,
    composeProjectName: agentName,
    sessionId,
  });

  if (globalThis.sessionTracker?.patchLiveViewVncPort) {
    await globalThis.sessionTracker.patchLiveViewVncPort(sessionId, null);
  }
};
