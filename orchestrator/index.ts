import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";

import "dotenv/config";
import { parseStageEnvelope, type StageEnvelope, type StageSessionInput } from "../shared/stage-contract";
import {
  createRuntimeContext,
  extractAiLogic,
  getStages,
  resetStageContext,
  setContextValue,
  toStageContextPayload,
} from "./runtime";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

const projectRoot = path.resolve(moduleDir, "..");
const envFilePath = path.resolve(projectRoot, ".env");
const yahlPath = path.resolve(projectRoot, "orchestrator", "YAHL");
const imageName = "project-yahl-runner";
const agentPath = path.resolve(projectRoot, "agent", "Agent.md");
const containerName = "project-yahl-runner-main";
const workspacePath = path.resolve(projectRoot, "workspace");
const skillsPath = path.resolve(projectRoot, "orchestrator", "SKILLS");
// const reportNewsDirPath = path.resolve(projectRoot, "orchestrator", "SKILLS", "test");
const reportNewsDirPath = path.resolve(projectRoot, "orchestrator", "SKILLS", "report_news");

const runCommand = (
  args: string[],
  options?: {
    ignoreFailure?: boolean;
  },
) => new Promise<void>((resolve, reject) => {
  const child = spawn("docker", args, {
    stdio: "inherit",
  });

  child.on("error", reject);

  child.on("close", (code) => {
    if (code === 0 || options?.ignoreFailure) {
      resolve();
      return;
    }

    reject(new Error(`docker ${args.join(" ")} failed with code ${code || -1}`));
  });
});

const runCommandCollect = (args: string[]) =>
  new Promise<{
    stderr: string;
    stdout: string;
  }>((resolve, reject) => {
    const child = spawn("docker", args, {
      stdio: [
        "ignore",
        "pipe",
        "pipe",
      ],
    });
    const stderrChunks: Buffer[] = [];
    const stdoutChunks: Buffer[] = [];

    child.on("error", reject);
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
      console.log('stderr', chunk.toString('utf-8'));
    });
    child.on("close", (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString("utf-8");
      const stderr = Buffer.concat(stderrChunks).toString("utf-8");

      if (code === 0) {
        resolve({
          stderr,
          stdout,
        });
        return;
      }

      reject(new Error(`docker ${args.join(" ")} failed with code ${code || -1}\n${stderr}`));
    });
  });

const buildImage = async () => {
  await runCommand([
    "build",
    "-f",
    path.resolve(projectRoot, "Dockerfile.runner"),
    "-t",
    imageName,
    projectRoot,
  ]);
};

const resolveReportPromptPath = async () => {
  const candidates = [
    path.resolve(reportNewsDirPath, "SKILL.md"),
    path.resolve(reportNewsDirPath, "index.md"),
    path.resolve(reportNewsDirPath, "SKILL.yahl"),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch { }
  }

  throw new Error(`No report prompt file found in ${reportNewsDirPath}`);
};

const runContainer = async () => {
  await runCommand([
    "run",
    "-d",
    "--rm",
    "--name",
    containerName,
    "--env-file",
    envFilePath,
    "-v",
    `${workspacePath}:/root`,
    "-v",
    `${agentPath}:/opt/agent/Agent.md:ro`,
    "-v",
    `${yahlPath}:/opt/yahl:ro`,
    "-v",
    `${skillsPath}:/opt/skills:ro`,
    imageName,
    "bash",
    "-lc",
    "sleep infinity",
  ]);
};

const extractJsonLine = (stdout: string) =>
  stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .find((line) =>
      (line.startsWith("{") && line.endsWith("}")) ||
      (line.startsWith("[") && line.endsWith("]"))
    ) || "";

const parseAgentEnvelope = (stdout: string): StageEnvelope => {
  const jsonLine = extractJsonLine(stdout);
  const parsed = parseStageEnvelope(jsonLine);

  if (parsed) return parsed;

  return {
    output: stdout.trim(),
    type: "result",
  };
};

const execStageAgent = async (input: StageSessionInput) => {
  const stageInputBase64 = Buffer.from(JSON.stringify(input), "utf-8").toString("base64");
  const args = [
    "exec",
    "-i",
    "-e",
    `AGENT_STAGE_INPUT_BASE64=${stageInputBase64}`,
    containerName,
    "bash",
    "-lc",
    "cd /app && pnpm --silent run agent -- --non-interactive --agent-md /opt/agent/Agent.md --yahl-dir /opt/yahl --stage-input-base64 \"$AGENT_STAGE_INPUT_BASE64\"",
  ];

  const result = await runCommandCollect(args);
  return parseAgentEnvelope(result.stdout);
};

const stopContainer = async () => {
  await runCommand([
    "rm",
    "-f",
    containerName,
  ], {
    ignoreFailure: true,
  });
};

const main = async () => {
  const reportPath = await resolveReportPromptPath();
  const reportSkill = await fs.readFile(reportPath, "utf-8");
  const aiLogic = extractAiLogic(reportSkill);

  if (!aiLogic) {
    throw new Error(`No ai.logic block found in ${reportPath}`);
  }

  const stages = getStages(aiLogic);

  if (stages.length <= 0) {
    throw new Error("No stages parsed from ai.logic");
  }

  await fs.mkdir(workspacePath, {
    recursive: true,
  });
  await stopContainer();
  await buildImage();
  await runContainer();

  try {
    const runtime = createRuntimeContext();

    for (const stage of stages) {
      resetStageContext(runtime);

      const currentStage = stage;
      const context = toStageContextPayload(runtime);

      console.log('\n', '----- Stage -----', '\n');
      console.log('request', JSON.stringify({ context, currentStage }, null, 2));

      process.stdout.write('Press [Enter] or [Space] to continue...\n');

      await new Promise<void>((resolve) => {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.once('data', (data: Buffer) => {
          // Accept space or enter
          if (data[0] === 32 || data[0] === 13 || data[0] === 10) {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            resolve();
          }
        });
      });

      const envelope = await execStageAgent({ context, currentStage });

      if (Array.isArray(envelope)) {
        envelope
          .filter(item => item.type === 'tool_call' && item.tool === 'set_context')
          .forEach(item => {
            setContextValue(
              runtime,
              /*envelope.arguments.scope*/'global',
              item.arguments.key,
              item.arguments.value,
            );
          });
        process.stdout.write(`[Orchestrator Stage] set_context calls, length: ${envelope.length}\n`);
      } else {
        process.stdout.write(`[Orchestrator Stage] ${envelope.type}\n`);
      }

    }

    process.stdout.write(`${JSON.stringify(toStageContextPayload(runtime), null, 2)}\n`);
  } finally {
    await stopContainer();
  }
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[Orchestrator Error] ${message}\n`);
  process.exit(1);
});