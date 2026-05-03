import path from "path";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";

import type { StageExecutionMeta } from "../shared/transport";
import type { StageSessionInput } from "../shared/stage-contract";

import type { CliForkedFrom, CliOptions } from "./orchestrator-types";
import { repoRoot, tasksRoot } from "./paths";

export const normalizeContainerName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 63) || "session";

const parseArgPairs = () => {
  const args = process.argv.slice(2);

  return args.reduce((acc, value, index) => {
    if (!value.startsWith("--")) return acc;
    const key = value.replace(/^--/, "");
    const next = args[index + 1];

    if (!next || next.startsWith("--")) {
      acc[key] = "true";
      return acc;
    }

    acc[key] = next;
    return acc;
  }, {} as Record<string, string>);
};

const decodeBase64Json = <T>(value: string | undefined): T | undefined => {
  if (!value) return undefined;

  try {
    const raw = Buffer.from(value, "base64").toString("utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
};

const decodeJsonFile = async <T>(filePath: string | undefined): Promise<T | undefined> => {
  if (!filePath) return undefined;

  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
};

export const resolveCliOptions = async (): Promise<CliOptions> => {
  const pairs = parseArgPairs();

  const taskPathRaw = pairs["task-path"] || process.env.ORCHESTRATOR_TASK_PATH || "";
  const taskId = pairs["task-id"] || process.env.ORCHESTRATOR_TASK_ID || "test";
  const taskPath = taskPathRaw
    ? path.resolve(repoRoot, taskPathRaw)
    : path.resolve(tasksRoot, taskId, "SKILL.yahl");
    
  const resumeMode = pairs["resume-mode"] || "";
  const resumeExecutionMeta =
    await decodeJsonFile<StageExecutionMeta>(pairs["resume-execution-meta-file"]) ||
    decodeBase64Json<StageExecutionMeta>(pairs["resume-execution-meta-base64"]);
  const resumeStageInput =
    await decodeJsonFile<StageSessionInput>(pairs["resume-stage-input-file"]) ||
    decodeBase64Json<StageSessionInput>(pairs["resume-stage-input-base64"]);
  const forkedFrom =
    await decodeJsonFile<CliForkedFrom>(pairs["forked-from-file"]) ||
    decodeBase64Json<CliForkedFrom>(pairs["forked-from-base64"]);

  return {
    agentContainerPrefix: pairs["agent-container-prefix"] || process.env.AGENT_CONTAINER_PREFIX || "runtime-agent",
    composeProjectPrefix: pairs["compose-project-prefix"] || process.env.COMPOSE_PROJECT_PREFIX || "runtime-agent",
    forkedFrom,
    resume: resumeMode === "request" && resumeExecutionMeta && resumeStageInput
      ? {
        executionMeta: resumeExecutionMeta,
        requestSnapshotOverride: resumeStageInput,
        sourceRequestId: pairs["resume-source-request-id"] || "",
        sourceSessionId: pairs["resume-source-session-id"] || "",
        stepIndex: Number(pairs["resume-from-step-index"] || 0),
      }
      : undefined,
    sessionId: normalizeContainerName(pairs["session-id"] || process.env.ORCHESTRATOR_SESSION_ID || randomUUID()),
    taskId,
    taskPath,
  };
};
