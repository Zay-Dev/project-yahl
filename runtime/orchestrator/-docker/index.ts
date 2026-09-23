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

const isRegistryImageRef = (image: string) => image.includes('/');

const localImageExists = (image: string) => {
  try {
    execSync(`docker image inspect "${image}"`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

const pullImageBestEffort = (image: string) => {
  if (!isRegistryImageRef(image)) {
    return;
  }

  if (localImageExists(image)) {
    console.log(`[orchestrator] cache seed already present ${image}; skip pull`);
    return;
  }

  try {
    console.log(`[orchestrator] pulling cache seed ${image}...`);
    execSync(`docker pull "${image}"`, { stdio: 'inherit' });
  } catch (err) {
    console.warn(`[orchestrator] pull failed for ${image}; continuing with local cache`, err);
  }
};

const composeBuildEnv = (buildContext: string, hostRepoRoot: string) => ({
  ...process.env,
  DOCKER_BUILDKIT: process.env.DOCKER_BUILDKIT || '1',
  BUILDX_NO_DEFAULT_ATTESTATIONS: process.env.BUILDX_NO_DEFAULT_ATTESTATIONS || '1',
  OMNIFLEX_BUILD_CONTEXT: buildContext,
  HOST_REPO_ROOT: hostRepoRoot,
});

const composeBuildFlags = '--provenance=false --sbom=false';

export const buildBrowser = () => {
  try {
    process.env.BROWSER_IMAGE = process.env.BROWSER_IMAGE || 'project-yahl-browser:latest';

    const hostRepoRoot = resolveDockerHostRepoRoot();
    const buildContext = resolveOmniflexBuildContext();
    const hostComposeFile = path.join(hostRepoRoot, 'docker-compose.browser.yml');

    pullImageBestEffort(process.env.BROWSER_IMAGE);

    console.log(`[orchestrator] browser build context=${buildContext}`);
    console.log(`[orchestrator] browser compose file=${hostComposeFile}`);
    console.log('Running: docker compose build browser...');
    execSync(`docker compose -f "${hostComposeFile}" build ${composeBuildFlags} browser`, {
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

    pullImageBestEffort(process.env.AGENT_IMAGE);

    console.log(`[orchestrator] agent build context=${buildContext}`);
    console.log(`[orchestrator] agent compose file=${hostComposeFile}`);
    console.log("Running: docker compose build agent...");
    execSync(`docker compose -f "${hostComposeFile}" build ${composeBuildFlags} agent`, {
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
