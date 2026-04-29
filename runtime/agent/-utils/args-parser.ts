import config from "../config";

import path from "path";

export type TCliOptions = {
  agentMdPath: string;
  daemon: boolean;
  nonInteractive: boolean;
  promptBase64: string;
  stageInputBase64: string;
  yahlDirPath: string;
};

const moduleDir = config.moduleDir;

export const parseArgs = (): TCliOptions => {
  const args = process.argv.slice(2);
  const pairs = args.reduce((acc, value, index) => {
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

  const defaultAgentMdPath = path.resolve(moduleDir, "Agent.md");
  const defaultYahlDirPath = path.resolve(process.cwd(), "orchestrator", "YAHL");

  return {
    agentMdPath: pairs["agent-md"] || process.env.AGENT_MD_PATH || defaultAgentMdPath,
    daemon: pairs["daemon"] === "true" || process.env.AGENT_DAEMON === "1",
    nonInteractive: pairs["non-interactive"] === "true" || process.env.AGENT_NON_INTERACTIVE === "1",
    promptBase64: pairs["prompt-base64"] || process.env.AGENT_PROMPT_BASE64 || "",
    stageInputBase64: pairs["stage-input-base64"] || process.env.AGENT_STAGE_INPUT_BASE64 || "",
    yahlDirPath: pairs["yahl-dir"] || process.env.AGENT_YAHL_DIR || defaultYahlDirPath,
  };
};