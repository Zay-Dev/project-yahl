import { execSync } from "child_process";
import path from "path";

import { composeFile, repoRoot } from "./paths";

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

const BROWSER_COMPOSE_FILE = path.join(repoRoot, 'docker-compose.browser.yml');

export const buildBrowser = () => {
  try {
    process.env.BROWSER_IMAGE = process.env.BROWSER_IMAGE || 'project-yahl-browser:latest';

    console.log('Running: docker compose build browser...');
    execSync(`docker compose -f "${BROWSER_COMPOSE_FILE}" build browser`, {
      cwd: repoRoot,
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

    console.log("Running: docker compose build agent...");
    execSync(`docker compose -f "${composeFile}" build agent`, {
      cwd: repoRoot,
      stdio: "inherit",
    });
    console.log("Docker compose build completed for agent.");
  } catch (err) {
    console.error("Failed to build agent using docker compose:", err);
    throw err;
  }
};
