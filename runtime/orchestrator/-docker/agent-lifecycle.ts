import { composeDown, resolveAgentComposeOverrideFiles } from './compose-agent';

export const shutdownAgent = async (agentName: string, sessionId: string) => {
  const composeOverrideFilePaths = await resolveAgentComposeOverrideFiles(sessionId);

  await composeDown({
    composeOverrideFilePaths,
    composeProjectName: agentName,
    sessionId,
  });

  // Live view VNC is on the browser sidecar; keep liveViewVncPort across agent pause.
};
