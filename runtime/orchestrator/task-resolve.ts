import path from "path";
import { promises as fs } from "fs";

import type { CliOptions } from "./orchestrator-types";
import { tasksRoot } from "./paths";

export const resolveReportPromptPath = async (opts: CliOptions) => {
  if (opts.taskPath) {
    try {
      await fs.access(opts.taskPath);
      return opts.taskPath;
    } catch { }
  }

  const reportNewsDirPath = path.resolve(tasksRoot, opts.taskId);
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
