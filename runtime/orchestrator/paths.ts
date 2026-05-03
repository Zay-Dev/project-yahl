import path from "path";
import { fileURLToPath } from "url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export const projectRoot = path.resolve(moduleDir, "..");
export const repoRoot = path.resolve(projectRoot, "..");
export const composeFile = path.resolve(projectRoot, "docker-compose.yml");
export const onecliRuntimePath = path.resolve(projectRoot, ".onecli");
export const onecliSharedCaFile = path.resolve(onecliRuntimePath, "proxy-ca.pem");
export const onecliSharedCombinedCaFile = path.resolve(onecliRuntimePath, "combined-ca.pem");
export const onecliSharedComposeOverrideFile = path.resolve(
  onecliRuntimePath,
  "docker-compose.onecli.override.yml",
);
export const tasksRoot = path.resolve(projectRoot, "orchestrator", "TASKS");
export const workspacePath = path.resolve(repoRoot, "workspace");
