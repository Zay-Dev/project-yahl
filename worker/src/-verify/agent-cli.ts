import { spawn } from 'child_process';

let agentCliReady = false;

export const isAgentCliReady = () => agentCliReady;

export const probeAgentCli = (): Promise<boolean> =>
  new Promise((resolve) => {
    const child = spawn('agent', ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.on('error', () => {
      agentCliReady = false;
      resolve(false);
    });

    child.on('close', (code) => {
      agentCliReady = code === 0;

      if (agentCliReady) {
        console.log(`[worker] agent CLI ready version=${stdout.trim()}`);
      }

      resolve(agentCliReady);
    });
  });

export const assertAgentCliOnBoot = async () => {
  const ok = await probeAgentCli();

  if (!ok) {
    console.error(
      '[worker] agent CLI not found on PATH — verify will fail until agent is installed (use /usr/local/bin, not /root/.local)',
    );
  }
};
