import { randomUUID } from 'crypto';
import { Command, Option } from "commander";

const _normalizeContainerName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 63) || "session";

export const resolveSessionId = (value?: string) =>
  value ? _normalizeContainerName(value) : _normalizeContainerName(randomUUID());

export const program = new Command();

export const runCommand = program
  .command("run")
  .description("Run the orchestrator")

  .addOption(
    new Option('--task-id <id>')
      .conflicts(['resume-id', 'forkrun-id', 'verify-resume-id', 'produce-keys-resume-id'])
  )
  .addOption(
    new Option('--resume-id <id>')
      .conflicts(['task-id', 'forkrun-id', 'verify-resume-id', 'produce-keys-resume-id'])
  )
  .addOption(
    new Option('--verify-resume-id <id>')
      .conflicts(['task-id', 'forkrun-id', 'resume-id', 'produce-keys-resume-id'])
  )
  .addOption(
    new Option('--produce-keys-resume-id <id>')
      .conflicts(['task-id', 'forkrun-id', 'resume-id', 'verify-resume-id'])
  )
  .addOption(
    new Option('--forkrun-id <id>')
      .conflicts(['task-id', 'resume-id', 'verify-resume-id', 'produce-keys-resume-id'])
  )
  .addOption(
    new Option('--session-id <id>')
      .argParser(_normalizeContainerName),
  );