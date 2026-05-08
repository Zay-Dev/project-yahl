import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import type { SessionForkedFromWire } from "./types";

export type RuntimeTask = {
  id: string;
  label: string;
  taskPath: string;
};

type RunStatus = "completed" | "failed" | "running";

type RunLogEvent = {
  line: string;
  ts: string;
};

type RunState = {
  createdAt: string;
  exitCode: number | null;
  logs: RunLogEvent[];
  process: ChildProcessWithoutNullStreams | null;
  runId: string;
  sessionId: string;
  status: RunStatus;
  subscribers: Set<(event: RunLogEvent) => void>;
  taskId: string;
  taskPath: string;
};

type StartRunResult = {
  createdAt: string;
  runId: string;
  sessionId: string;
  status: RunStatus;
  taskId: string;
};

export type AskUserResumeFilePayload = {
  currentStageText: string;
  questionId: string;
  requestId: string;
  runtimeSnapshot: {
    context: Record<string, unknown>;
    stage: Record<string, unknown>;
    types: Record<string, unknown>;
  };
  sourceRef: {
    filePath: string;
    line: number;
  };
  stageId: string;
  version: "askUserResume.v1";
};

type StartRerunFromRequestInput = {
  forkrunFormId: string;
  forkedFrom: SessionForkedFromWire;
  requestSnapshotOverride: {
    context: Record<string, unknown>;
    currentStage: string;
  };
  resumeExecutionMeta: unknown;
  sourceRequestId: string;
  sourceSessionId: string;
  sourceStageId: string;
};

const MAX_LOG_EVENTS = 1000;
const TASK_FILE_NAME = "SKILL.yahl";

const toTaskId = (taskPath: string, tasksRoot: string) =>
  path.dirname(path.relative(tasksRoot, taskPath)).replaceAll(path.sep, "/");

const listFilesRecursively = async (dirPath: string): Promise<string[]> => {
  const entries = await fs.readdir(dirPath, {
    withFileTypes: true,
  });

  const nested = await Promise.all(entries.map(async (entry) => {
    const absPath = path.resolve(dirPath, entry.name);

    if (entry.isDirectory()) return await listFilesRecursively(absPath);
    return [absPath];
  }));

  return nested.flat();
};

const discoverTasks = async (tasksRoot: string): Promise<RuntimeTask[]> => {
  const files = await listFilesRecursively(tasksRoot);

  return files
    .filter((filePath) =>
      path.basename(filePath) === TASK_FILE_NAME &&
      !filePath.split(path.sep).includes(".fork-snapshots"),
    )
    .map((filePath) => {
      const id = toTaskId(filePath, tasksRoot);
      return {
        id,
        label: id.replaceAll("_", " "),
        taskPath: filePath,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
};

const appendLog = (run: RunState, line: string) => {
  const event = {
    line,
    ts: new Date().toISOString(),
  };

  run.logs.push(event);
  if (run.logs.length > MAX_LOG_EVENTS) {
    run.logs = run.logs.slice(-MAX_LOG_EVENTS);
  }

  run.subscribers.forEach((emit) => emit(event));
};

const normalizeSessionId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 63) || "session";

const writeJsonFile = async (
  directoryPath: string,
  fileName: string,
  value: unknown,
) => {
  await fs.mkdir(directoryPath, {
    recursive: true,
  });
  const filePath = path.resolve(directoryPath, fileName);
  await fs.writeFile(filePath, JSON.stringify(value), "utf-8");
  return filePath;
};

export const createRunManager = () => {
  const repoRoot = path.resolve(process.env.RUNTIME_REPO_ROOT || path.resolve(process.cwd(), ".."));
  const runtimeRoot = path.resolve(repoRoot, "runtime");
  const tasksRoot = path.resolve(runtimeRoot, "orchestrator", "TASKS");
  const runs = new Map<string, RunState>();

  const listTasks = async () => await discoverTasks(tasksRoot);

  const startProcess = (
    taskId: string,
    taskPath: string,
    args: string[],
    opts?: { sessionId?: string },
  ): StartRunResult => {
    const runId = randomUUID();
    const sessionId = opts?.sessionId
      ? normalizeSessionId(opts.sessionId)
      : normalizeSessionId(randomUUID());
    const run: RunState = {
      createdAt: new Date().toISOString(),
      exitCode: null,
      logs: [],
      process: null,
      runId,
      sessionId,
      status: "running",
      subscribers: new Set(),
      taskId,
      taskPath,
    };

    const child = spawn(
      "pnpm",
      [
        "--filter",
        "runtime",
        "run",
        "orchestrate",
        "--",
        "--session-id",
        sessionId,
        ...args,
      ],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          AGENT_CONTAINER_PREFIX: process.env.AGENT_CONTAINER_PREFIX || "agent",
          COMPOSE_PROJECT_PREFIX: process.env.COMPOSE_PROJECT_PREFIX || "runtime-agent",
          REDIS_URL: process.env.REDIS_URL || "redis://redis:6379",
          SESSION_API_BASE_URL: process.env.SESSION_API_BASE_URL || "http://127.0.0.1:4000",
        },
        stdio: "pipe",
      },
    );

    run.process = child;
    runs.set(runId, run);

    appendLog(run, `[run] started task=${taskId} session=${sessionId}`);

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString("utf-8");
      for (const line of text.split(/\r?\n/).filter(Boolean)) {
        appendLog(run, line);
      }
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString("utf-8");
      for (const line of text.split(/\r?\n/).filter(Boolean)) {
        appendLog(run, `[stderr] ${line}`);
      }
    });

    child.on("close", (code) => {
      run.exitCode = code;
      run.status = code === 0 ? "completed" : "failed";
      appendLog(run, `[run] exited with code ${code ?? -1}`);
      run.process = null;
    });

    child.on("error", (error) => {
      run.exitCode = -1;
      run.status = "failed";
      appendLog(run, `[run] spawn failed: ${String(error)}`);
      run.process = null;
    });

    return {
      createdAt: run.createdAt,
      runId: run.runId,
      sessionId: run.sessionId,
      status: run.status,
      taskId: run.taskId,
    };
  };

  const startRun = async (taskId: string) => {
    const tasks = await listTasks();
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task) return null;

    return startProcess(task.id, task.taskPath, [
      "--task-path",
      task.taskPath,
    ]);
  };

  const startAskUserResume = async (
    rawSessionId: string,
    taskYahlPathRaw: string,
    recovery: Omit<AskUserResumeFilePayload, "version">,
  ) => {
    const sessionId = normalizeSessionId(rawSessionId);
    const taskPathResolved = path.isAbsolute(taskYahlPathRaw)
      ? taskYahlPathRaw
      : path.resolve(repoRoot, taskYahlPathRaw);

    const payloadRoot = path.resolve(runtimeRoot, ".ask-user-resume");
    const payloadId = randomUUID();
    const diskPath = await writeJsonFile(payloadRoot, `${payloadId}-ask-user-resume.json`, {
      version: "askUserResume.v1",
      ...recovery,
    });

    return startProcess(
      `ask-user-resume/${sessionId}`,
      taskPathResolved,
      [
        "--task-path",
        taskPathResolved,
        "--resume-ask-user-recovery",
        diskPath,
      ],
      { sessionId },
    );
  };

  const startRerunFromRequest = async (
    input: StartRerunFromRequestInput,
  ) => {
    const taskId = `rerun/${input.sourceSessionId}`;
    const taskPath = `rerun:${input.sourceSessionId}:${input.sourceStageId}`;
    const payloadRoot = path.resolve(runtimeRoot, ".rerun-payloads");
    const payloadId = randomUUID();
    const executionMetaPath = await writeJsonFile(
      payloadRoot,
      `${payloadId}-execution-meta.json`,
      input.resumeExecutionMeta,
    );
    const forkedFromPath = await writeJsonFile(
      payloadRoot,
      `${payloadId}-forked-from.json`,
      input.forkedFrom,
    );

    return startProcess(taskId, taskPath, [
      "--resume-mode",
      "request",
      "--resume-source-session-id",
      input.sourceSessionId,
      "--resume-source-request-id",
      input.sourceRequestId,
      "--resume-source-stage-id",
      input.sourceStageId,
      "--resume-from-step-index",
      String(input.forkedFrom.stepIndex),
      "--forkrun-form-id",
      input.forkrunFormId,
      "--resume-execution-meta-file",
      executionMetaPath,
      "--forked-from-file",
      forkedFromPath,
    ]);
  };

  const getRun = (runId: string) => runs.get(runId) || null;

  const subscribeLogs = (
    runId: string,
    onEvent: (event: RunLogEvent) => void,
  ) => {
    const run = runs.get(runId);
    if (!run) return null;

    run.logs.forEach(onEvent);
    run.subscribers.add(onEvent);

    return () => {
      run.subscribers.delete(onEvent);
    };
  };

  return {
    getRun,
    listTasks,
    startAskUserResume,
    startRerunFromRequest,
    startRun,
    subscribeLogs,
  };
};
