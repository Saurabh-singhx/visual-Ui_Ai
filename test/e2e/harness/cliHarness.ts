import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface CliOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  binPath?: string;
  timeout?: number;
}

export interface CliJsonOptions extends CliOptions {
  allowNonZeroExit?: boolean;
}

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  combinedOutput: string;
}

/**
 * Resolves the absolute path to bin/visual-ui.js
 */
export function resolveBinPath(customPath?: string): string {
  if (customPath) {
    return path.resolve(customPath);
  }
  if (process.env.VISUAL_UI_BIN) {
    return path.resolve(process.env.VISUAL_UI_BIN);
  }
  // Default: visual_uiai/bin/visual-ui.js
  return path.resolve(__dirname, '../../../bin/visual-ui.js');
}

/**
 * Executes bin/visual-ui.js CLI with given arguments and options
 */
export function runCli(args: string[], options: CliOptions = {}): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const binPath = resolveBinPath(options.binPath);
    const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
    const timeout = options.timeout ?? 15000;

    const child = spawn(process.execPath, [binPath, ...args], {
      cwd,
      env: {
        ...process.env,
        ...options.env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });

    let timer: NodeJS.Timeout | null = null;
    if (timeout > 0) {
      timer = setTimeout(() => {
        try {
          child.kill('SIGTERM');
        } catch {
          // ignore
        }
        setTimeout(() => {
          if (child.exitCode === null) {
            try {
              child.kill('SIGKILL');
            } catch {
              // ignore
            }
          }
        }, 1000);
        reject(new Error(`CLI process timed out after ${timeout}ms: node ${binPath} ${args.join(' ')}`));
      }, timeout);
    }

    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? 0,
        combinedOutput: (stdout + '\n' + stderr).trim(),
      });
    });
  });
}

/**
 * Extracts and parses a JSON object or array from potentially noisy CLI output
 */
export function extractJsonFromOutput<T = any>(output: string): T {
  const trimmed = output.trim();
  // 1. Direct parse
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // Continue to candidate extraction
  }

  // 2. Collect candidate spans for objects {...} and arrays [...]
  interface Span {
    start: number;
    end: number;
    len: number;
  }
  const spans: Span[] = [];

  // Find braces
  const braceStarts: number[] = [];
  const braceEnds: number[] = [];
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '{') braceStarts.push(i);
    if (trimmed[i] === '}') braceEnds.push(i);
  }
  for (const start of braceStarts) {
    for (let j = braceEnds.length - 1; j >= 0; j--) {
      const end = braceEnds[j];
      if (end > start) {
        spans.push({ start, end, len: end - start + 1 });
      }
    }
  }

  // Find brackets
  const bracketStarts: number[] = [];
  const bracketEnds: number[] = [];
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '[') bracketStarts.push(i);
    if (trimmed[i] === ']') bracketEnds.push(i);
  }
  for (const start of bracketStarts) {
    for (let j = bracketEnds.length - 1; j >= 0; j--) {
      const end = bracketEnds[j];
      if (end > start) {
        spans.push({ start, end, len: end - start + 1 });
      }
    }
  }

  // Sort spans by descending length (largest enclosing candidate first)
  spans.sort((a, b) => b.len - a.len);

  for (const span of spans) {
    try {
      return JSON.parse(trimmed.slice(span.start, span.end + 1)) as T;
    } catch {
      // continue
    }
  }

  // 3. Line-by-line fallback
  const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    try {
      return JSON.parse(line) as T;
    } catch {
      // continue
    }
  }

  throw new Error(`Failed to parse CLI JSON output: ${output}`);
}

/**
 * Executes CLI and parses stdout as JSON
 */
export async function runCliJson<T = any>(
  args: string[],
  options: CliJsonOptions = {}
): Promise<{ result: CliResult; data: T }> {
  // Ensure --format json is present if not already specified
  const effectiveArgs = [...args];
  if (!effectiveArgs.includes('--format')) {
    effectiveArgs.push('--format', 'json');
  }

  const result = await runCli(effectiveArgs, options);
  if (!options.allowNonZeroExit && result.exitCode !== 0) {
    throw new Error(`CLI command exited with code ${result.exitCode}: ${result.stderr || result.stdout}`);
  }

  try {
    const data = extractJsonFromOutput<T>(result.stdout);
    return { result, data };
  } catch (err: any) {
    if (options.allowNonZeroExit && result.stderr) {
      try {
        const data = extractJsonFromOutput<T>(result.stderr);
        return { result, data };
      } catch {
        // continue to throw below
      }
    }
    throw new Error(
      `Failed to find valid JSON payload in CLI output (exitCode: ${result.exitCode}):\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`
    );
  }
}
