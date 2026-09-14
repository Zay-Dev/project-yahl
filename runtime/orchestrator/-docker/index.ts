import { execSync } from "child_process";
import path from "path";

import { resolveDockerHostRepoRoot } from "./paths";

export {
  buildComposeDownArgs,
  buildComposeUpArgs,
  composeDown,
  composeUp,
  resolveAgentComposeOverrideFiles,
  writeAgentSessionOverride,
} from './compose-agent';

export {
  browserCdpUrl,
  ensureBrowser,
  pruneIdleBrowsers,
  resolveBrowserContainerName,
  shutdownBrowser,
  touchBrowserActivity,
} from './compose-browser';

export { writeSharedOneCliOverride } from './onecli-snapshot';

export { shutdownAgent } from './agent-lifecycle';

export { resolvePublishedVncPort } from './resolve-published-vnc-port';

export { abandonBrowserSession, pruneIdleBrowsersAndAbandon } from './abandon-browser-session';

const resolveOmniflexBuildContext = () => {
  const override = process.env.OMNIFLEX_BUILD_CONTEXT?.trim();

  if (override) {
    return path.resolve(override);
  }

  const hostRepoRoot = process.env.HOST_REPO_ROOT?.trim();

  if (!hostRepoRoot) {
    throw new Error(
      'HOST_REPO_ROOT is required for agent/browser image builds (Omniflex context = dirname(HOST_REPO_ROOT))',
    );
  }

  return path.resolve(hostRepoRoot, '..');
};

const composeBuildEnv = (buildContext: string, hostRepoRoot: string) => ({
  ...process.env,
  OMNIFLEX_BUILD_CONTEXT: buildContext,
  HOST_REPO_ROOT: hostRepoRoot,
});

export const buildBrowser = () => {
  try {
    process.env.BROWSER_IMAGE = process.env.BROWSER_IMAGE || 'project-yahl-browser:latest';

    const hostRepoRoot = resolveDockerHostRepoRoot();
    const buildContext = resolveOmniflexBuildContext();
    const hostComposeFile = path.join(hostRepoRoot, 'docker-compose.browser.yml');

    console.log(`[orchestrator] browser build context=${buildContext}`);
    console.log(`[orchestrator] browser compose file=${hostComposeFile}`);
    console.log('Running: docker compose build browser...');
    execSync(`docker compose -f "${hostComposeFile}" build browser`, {
      cwd: hostRepoRoot,
      env: composeBuildEnv(buildContext, hostRepoRoot),
      stdio: 'inherit',
    });
    console.log('Docker compose build completed for browser.');
  } catch (err) {
    console.error('Failed to build browser using docker compose:', err);
    throw err;
  }
};

export const buildAgent = () => {
  try {
    process.env.AGENT_IMAGE = process.env.AGENT_IMAGE || "project-yahl-agent:latest";

    const hostRepoRoot = resolveDockerHostRepoRoot();
    const buildContext = resolveOmniflexBuildContext();
    const hostComposeFile = path.join(hostRepoRoot, 'docker-compose.agent.yml');

    console.log(`[orchestrator] agent build context=${buildContext}`);
    console.log(`[orchestrator] agent compose file=${hostComposeFile}`);
    console.log("Running: docker compose build agent...");
    execSync(`docker compose -f "${hostComposeFile}" build agent`, {
      cwd: hostRepoRoot,
      env: composeBuildEnv(buildContext, hostRepoRoot),
      stdio: "inherit",
    });
    console.log("Docker compose build completed for agent.");
  } catch (err) {
    console.error("Failed to build agent using docker compose:", err);
    throw err;
  }
};
