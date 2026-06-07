import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export const projectRoot = path.resolve(moduleDir, "..");

const moduleRepoRoot = path.resolve(projectRoot, "..");

const runtimeComposeAt = (root: string) => path.join(root, "runtime", "docker-compose.yml");

export const repoRoot = (() => {
  const hostRepoRoot = process.env.HOST_REPO_ROOT?.trim();

  if (hostRepoRoot) {
    const resolved = path.resolve(hostRepoRoot);

    if (fs.existsSync(runtimeComposeAt(resolved))) {
      return resolved;
    }
  }

  return moduleRepoRoot;
})();

if (process.env.HOST_REPO_ROOT?.trim() !== repoRoot) {
  process.env.HOST_REPO_ROOT = repoRoot;
}

export const runtimeRoot = path.join(repoRoot, "runtime");

export const omniflexRoot = path.resolve(repoRoot, "..");

export const composeFile = path.join(runtimeRoot, "docker-compose.yml");
export const onecliRuntimePath = path.join(runtimeRoot, ".onecli");
export const onecliSharedCaFile = path.join(onecliRuntimePath, "proxy-ca.pem");
export const onecliSharedCombinedCaFile = path.join(onecliRuntimePath, "combined-ca.pem");

export const onecliSharedComposeOverrideFile = path.join(
  onecliRuntimePath,
  "docker-compose.onecli.override.yml",
);

export const tasksRoot = path.join(runtimeRoot, "orchestrator", "TASKS");
export const workspacePath = path.join(repoRoot, "workspace");
