import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export const parseDockerPortOutput = (output: string) => {
  const line = output.trim().split('\n').find((entry) => entry.trim())?.trim();

  if (!line) {
    return undefined;
  }

  const match = line.match(/:(\d+)\s*$/);

  if (!match) {
    return undefined;
  }

  const port = Number.parseInt(match[1]!, 10);

  return Number.isFinite(port) && port > 0 ? port : undefined;
};

export const resolvePublishedVncPort = async (containerName: string) => {
  const { stdout } = await execFileAsync('docker', [
    'port',
    containerName,
    '5900/tcp',
  ]);

  const port = parseDockerPortOutput(stdout);

  if (!port) {
    throw new Error(
      `failed to resolve VNC host port for ${containerName}: ${stdout.trim() || '<empty>'}`,
    );
  }

  return port;
};
