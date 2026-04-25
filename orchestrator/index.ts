import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";

import "dotenv/config";
import { parseStageEnvelope, type StageEnvelope, type StageSessionInput } from "../shared/stage-contract";
import {
  type RuntimeContext,
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
//const reportNewsDirPath = path.resolve(projectRoot, "orchestrator", "SKILLS", "test");
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

const parseLoop = (line: string, context: RuntimeContext) => {
  const matchMeta = line.match(/^\s*for each (\w+) of (\[.*\])/i);

  if (!matchMeta) {
    return null;
  }

  const indexName = matchMeta[1];
  const arrayName = matchMeta[2];

  const loopSetup = (() => {
    const matchRange = arrayName.match(/\[(\d+)\.\.(\d+)(,[+-]?(\d+))?\]/);

    if (matchRange) {
      const startAt = parseInt(matchRange[1]);
      const endAfter = parseInt(matchRange[2]);

      const step = matchRange[3] ? parseInt(matchRange[3].slice(1)) :
        (startAt > endAfter ? -1 : 1);

      return { startAt, endAfter, step };
    }

    const matchArray = arrayName.match(/\[(\w+)(,[+-]?(\d+))?\]/);

    if (matchArray) {
      const arrayName = matchArray[1];
      const stageArray = context.get('stage')?.[arrayName];
      const contextArray = context.get('context')?.[arrayName];

      const array = stageArray && Array.isArray(stageArray) ? stageArray : contextArray;
      if (!array || !Array.isArray(array)) return null;

      const step = matchArray[2] ? parseInt(matchArray[2].slice(1)) : 1;

      const startAt = step >= 0 ? 0 : array.length - 1;
      const endAfter = step >= 0 ? array.length - 1 : 0;

      return { startAt, endAfter, step, array };
    }

    return null;
  })();

  if (!loopSetup) return null;

  const { startAt, endAfter, step } = loopSetup;

  if (startAt > endAfter && step > 0) {
    throw new Error(`Invalid range: ${startAt}..${endAfter}, step ${step}`);
  } else if (endAfter > startAt && step < 0) {
    throw new Error(`Invalid range: ${startAt}..${endAfter}, step ${step}`);
  }

  return { indexName, ...loopSetup };
}

const execute = async (text: string, stageContext: Record<string, unknown> = {}) => {
  const aiLogic = extractAiLogic(text);
  if (!aiLogic) {
    throw new Error('No ai.logic block found');
  }

  const stages = getStages(aiLogic);

  if (stages.length <= 0) {
    throw new Error("No stages parsed from ai.logic");
  }

  try {
    const runtime = createRuntimeContext();

    for (const { type, lines } of stages) {
      resetStageContext(runtime);
      Object.assign(runtime.get('stage')!, stageContext);

      if (type === 'loop') {
        const loopSetup = parseLoop(lines, runtime);
        if (!loopSetup) {
          console.error(lines);
          throw new Error('Invalid loop setup occurred in the above stage');
        }

        const { indexName, startAt, endAfter, step, array } = loopSetup;
        let i = startAt;

        while (step >= 0 ? i <= endAfter : i >= endAfter) {
          const currentValue = !!array ? array[i] || null : i;
          const aiBlock = `\`\`\`ai.logic\n${lines.substring(lines.indexOf('{'))}\n\`\`\``;

          const toContext = (records: Record<string, unknown>) => {
            return Object.keys(records)
              .filter(key => aiBlock.includes(key))
              .reduce((acc, key) => {
                acc[key] = records[key];
                return acc;
              }, {} as Record<string, unknown>);
          }

          const loopRuntime = await execute(aiBlock, {
            ...toContext(runtime.get('context')!),
            ...toContext(runtime.get('stage')!),

            [indexName]: currentValue,
          });

          const myContext = runtime.get('context')!;
          const loopContext = loopRuntime.get('context')!;

          const myStage = runtime.get('stage')!;
          const loopStage = loopRuntime.get('stage')!;

          for (const key of Object.keys(loopContext)) {
            if (Object.keys(myContext).includes(key)) {
              myContext[key] = loopContext[key];
            }
          }

          runtime.set('stage', { ...myStage, ...loopStage, ...loopContext });
          i += step;
        }

        continue;
      }

      const currentStage = lines;
      const context = toStageContextPayload(runtime);

      console.log('\n', '----- Stage -----', '\n');
      console.log('request', JSON.stringify({ context, currentStage, type }, null, 2));

      process.stdout.write('Press [Enter] or [Space] to continue, or any other key to abort...\n');

      await new Promise<void>((resolve) => {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.once('data', (data: Buffer) => {
          // Accept space or enter or ctrl+c
          if (data[0] === 32 || data[0] === 13 || data[0] === 10) {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            console.log('\nContinuing...\n');
            resolve();
          } else {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.exit(1);
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

    return runtime;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const main = async () => {
  const reportPath = await resolveReportPromptPath();
  const reportSkill = await fs.readFile(reportPath, "utf-8");

  await fs.mkdir(workspacePath, {
    recursive: true,
  });

  await stopContainer();
  await buildImage();
  await runContainer();

  const runtime = await execute(reportSkill);
  console.log('result', JSON.stringify(runtime.get('context')?.['result'], null, 2));

  await stopContainer();
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[Orchestrator Error] ${message}\n`);
  process.exit(1);
});