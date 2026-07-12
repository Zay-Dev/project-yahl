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
    new Option('--resume-id <id>')
      .conflicts(['verify-resume-id', 'produce-keys-resume-id'])
  )
  .addOption(
    new Option('--verify-resume-id <id>')
      .conflicts(['resume-id', 'produce-keys-resume-id'])
  )
  .addOption(
    new Option('--produce-keys-resume-id <id>')
      .conflicts(['resume-id', 'verify-resume-id'])
  )
  .addOption(
    new Option('--session-id <id>')
      .argParser(_normalizeContainerName),
  )
  .addOption(
    new Option('--nixery-def <id>'),
  )
  .addOption(
    new Option('--nixery-input <json>'),
  );
