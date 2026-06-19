import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import { config } from '../config.js';

export const runIsolatedBatchCli = async (prompt: string, runId: string): Promise<string> => {
  const runDir = path.join(config.batchRunsRoot, runId);

  fs.mkdirSync(runDir, { recursive: true });

  const logPath = path.join(runDir, 'output.json');

  if (!config.apiKey) {
    fs.writeFileSync(logPath, JSON.stringify({ result: `[batch-stub] ${prompt.slice(0, 200)}` }));
    return fs.readFileSync(logPath, 'utf8');
  }

  return new Promise((resolve, reject) => {
    const args = [
      '-p',
      '--force',
      '--yolo',
      '--output-format',
      'json',
      prompt,
    ];

    const child = spawn('agent', args, {
      cwd: runDir,
      env: {
        ...process.env,
        CURSOR_API_KEY: config.apiKey,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.on('error', reject);

    child.on('close', (code) => {
      fs.writeFileSync(logPath, stdout || JSON.stringify({ code }));

      if (code !== 0) {
        reject(new Error(`batch cli exited ${code}`));
        return;
      }

      resolve(stdout);
    });
  });
};
