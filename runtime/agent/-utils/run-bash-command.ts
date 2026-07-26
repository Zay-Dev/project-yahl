import { spawn } from 'node:child_process';

export type TRunBashResult = {
  durationMs: number;
  ok: boolean;
  output: string;
  timedOut: boolean;
};

export const runBashCommand = (
  command: string,
  timeoutMs: number,
): Promise<TRunBashResult> => {
  const startedAt = Date.now();
  const maxBuffer = 20 * 1024 * 1024;

  return new Promise((resolve) => {
    let settled = false;
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let truncated = false;

    const child = spawn('/bin/sh', ['-c', command], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const settle = (output: string, ok: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      clearTimeout(hardWall);

      resolve({
        durationMs: Date.now() - startedAt,
        ok,
        output,
        timedOut,
      });
    };

    const killGroup = () => {
      if (!child.pid) {
        return;
      }

      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        try {
          child.kill('SIGKILL');
        } catch {
          // already gone
        }
      }
    };

    const onTimeout = () => {
      timedOut = true;
      killGroup();
      settle(
        `run_bash: timed out after ${timeoutMs}ms (bashTimeoutMs=${timeoutMs}). Command: ${command}`,
        false,
      );
    };

    const appendChunk = (target: 'stdout' | 'stderr', chunk: Buffer | string) => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');

      if (target === 'stdout') {
        stdout += text;
      } else {
        stderr += text;
      }

      if (stdout.length + stderr.length > maxBuffer) {
        truncated = true;
        killGroup();
        settle(
          `${stdout.slice(0, maxBuffer)}${stderr.slice(0, Math.max(0, maxBuffer - stdout.length))}\nrun_bash: output exceeded ${maxBuffer} bytes`,
          false,
        );
      }
    };

    const timer = setTimeout(onTimeout, timeoutMs);
    const hardWall = setTimeout(onTimeout, timeoutMs + 2_000);

    child.stdout?.on('data', (chunk: Buffer | string) => {
      appendChunk('stdout', chunk);
    });

    child.stderr?.on('data', (chunk: Buffer | string) => {
      appendChunk('stderr', chunk);
    });

    child.on('error', (error) => {
      settle(`${stdout}${stderr}${error.message}`, false);
    });

    child.on('close', (code) => {
      if (timedOut || truncated) {
        return;
      }

      settle(`${stdout}${stderr}`, code === 0);
    });
  });
};
