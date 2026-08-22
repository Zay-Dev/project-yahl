import { spawn } from 'node:child_process';

export type TExecNodeScriptResult = {
  exitCode: number | null;
  parsed: unknown;
  stderr: string;
  stdout: string;
};

export const execNodeScript = async (
  scriptPath: string,
  args: unknown,
  timeoutMs = 60_000,
): Promise<TExecNodeScriptResult> => {
  const payload = `${JSON.stringify(args ?? {})}\n`;

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      child.kill('SIGKILL');
      reject(new Error(`node script timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += String(chunk);
    });

    child.on('error', (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    child.on('close', (exitCode) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);

      let parsed: unknown;

      try {
        parsed = stdout.trim() ? JSON.parse(stdout) : null;
      } catch {
        parsed = null;
      }

      resolve({
        exitCode,
        parsed,
        stderr,
        stdout,
      });
    });

    child.stdin.write(payload);
    child.stdin.end();
  });
};
