import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";

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
    .filter((filePath) => path.basename(filePath) === TASK_FILE_NAME)
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

export const createRunManager = () => {
  const repoRoot = path.resolve(process.env.RUNTIME_REPO_ROOT || path.resolve(process.cwd(), ".."));
  const runtimeRoot = path.resolve(repoRoot, "runtime");
  const tasksRoot = path.resolve(runtimeRoot, "orchestrator", "TASKS");
  const runs = new Map<string, RunState>();

  const listTasks = async () => await discoverTasks(tasksRoot);

  const startRun = async (taskId: string) => {
    const tasks = await listTasks();
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task) return null;

    const runId = randomUUID();
    const sessionId = normalizeSessionId(randomUUID());
    const run: RunState = {
      createdAt: new Date().toISOString(),
      exitCode: null,
      logs: [],
      process: null,
      runId,
      sessionId,
      status: "running",
      subscribers: new Set(),
      taskId: task.id,
      taskPath: task.taskPath,
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
        "--task-path",
        task.taskPath,
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

    appendLog(run, `[run] started task=${task.id} session=${sessionId}`);

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
    startRun,
    subscribeLogs,
  };
};
