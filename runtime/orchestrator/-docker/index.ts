import { execSync } from "child_process";

import { composeFile, repoRoot } from "./paths";

export { composeDown, composeUp, writeSharedOneCliOverride } from './compose-onecli';

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
