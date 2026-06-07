import { execSync } from "child_process";

import { composeFile, repoRoot } from "../paths";

export const buildAgent = () => {
  try {
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
