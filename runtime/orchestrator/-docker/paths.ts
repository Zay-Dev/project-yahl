import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

const stackComposeAt = (root: string) => path.join(root, "docker-compose.yml");
const agentComposeAt = (root: string) => path.join(root, "docker-compose.agent.yml");

const hasRepoCompose = (root: string) =>
  fs.existsSync(agentComposeAt(root)) || fs.existsSync(stackComposeAt(root));

const findRepoRootFromModule = () => {
  let current = moduleDir;

  for (let depth = 0; depth < 10; depth += 1) {
    if (hasRepoCompose(current)) {
      return current;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      break;
    }

    current = parent;
  }

  return path.resolve(moduleDir, "../../..");
};

export const repoRoot = (() => {
  const runtimeRepoRoot = process.env.RUNTIME_REPO_ROOT?.trim();

  if (runtimeRepoRoot) {
    const candidate = path.dirname(path.resolve(runtimeRepoRoot));

    if (hasRepoCompose(candidate)) {
      return candidate;
    }
  }

  const hostRepoRoot = process.env.HOST_REPO_ROOT?.trim();

  if (hostRepoRoot) {
    const resolved = path.resolve(hostRepoRoot);

    if (hasRepoCompose(resolved)) {
      return resolved;
    }
  }

  return findRepoRootFromModule();
})();

export const runtimeRoot = path.join(repoRoot, "runtime");

export const omniflexRoot = path.resolve(repoRoot, "..");

export const composeFile = agentComposeAt(repoRoot);

const resolveOnecliRuntimePath = () => {
  const hostRepoRoot = process.env.HOST_REPO_ROOT?.trim();

  if (hostRepoRoot) {
    return path.join(path.resolve(hostRepoRoot), "runtime", ".onecli");
  }

  return path.join(runtimeRoot, ".onecli");
};

export const onecliRuntimePath = resolveOnecliRuntimePath();
export const onecliSharedCaFile = path.join(onecliRuntimePath, "proxy-ca.pem");
export const onecliSharedCombinedCaFile = path.join(onecliRuntimePath, "combined-ca.pem");

export const onecliSharedComposeOverrideFile = path.join(
  onecliRuntimePath,
  "docker-compose.onecli.override.yml",
);

export const tasksRoot = path.join(runtimeRoot, "orchestrator", "TASKS");
export const workspacePath = path.join(repoRoot, "workspace");

export const agentSessionRuntimePath = (sessionId: string) =>
  path.join(runtimeRoot, ".agents", sessionId);

export const agentSessionComposeOverrideFile = (sessionId: string) =>
  path.join(agentSessionRuntimePath(sessionId), "compose.override.yml");
