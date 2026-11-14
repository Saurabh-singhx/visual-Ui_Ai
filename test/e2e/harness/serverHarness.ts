import { spawn, ChildProcess } from 'child_process';
import net from 'net';
import path from 'path';
import fs from 'fs';

export interface ServerOptions {
  port?: number;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  readyTimeoutMs?: number;
  readyEndpoint?: string;
}

export interface ServerInstance {
  port: number;
  baseUrl: string;
  pid?: number;
  process: ChildProcess;
  stop: () => Promise<void>;
}

/**
 * Finds a currently unused ephemeral port on the host
 */
export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const address = srv.address();
      if (!address || typeof address === 'string') {
        srv.close(() => reject(new Error('Failed to obtain free port address')));
        return;
      }
      const port = address.port;
      srv.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
    srv.on('error', reject);
  });
}

/**
 * Polls an HTTP endpoint until it responds with HTTP 200 OK or times out
 */
export async function waitForServerReady(
  baseUrl: string,
  endpoint: string = '/api/health',
  timeoutMs: number = 15000
): Promise<boolean> {
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (res.status === 200) {
        return true;
      }
    } catch {
      // Server not accepting connections yet, wait and retry
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  throw new Error(`Server at ${url} failed to become ready within ${timeoutMs}ms`);
}

/**
 * Spawns the visual-ui unified server on an isolated port and waits for readiness
 */
export async function startServer(options: ServerOptions = {}): Promise<ServerInstance> {
  const port = options.port ?? (await findFreePort());
  const baseUrl = `http://127.0.0.1:${port}`;
  const readyTimeout = options.readyTimeoutMs ?? 15000;
  const readyEndpoint = options.readyEndpoint ?? '/api/health';

  const projectRoot = path.resolve(__dirname, '../../../');
  const serverDir = path.resolve(projectRoot, 'server');
  const serverEntry = path.resolve(serverDir, 'src/index.ts');

  // Locate tsx executable with fallback resolution
  let spawnCmd: string;
  let spawnArgs: string[];

  const serverTsx = path.resolve(projectRoot, 'server/node_modules/.bin/tsx');
  const rootTsx = path.resolve(projectRoot, 'node_modules/.bin/tsx');

  if (fs.existsSync(serverTsx)) {
    spawnCmd = process.execPath;
    spawnArgs = [serverTsx, serverEntry];
  } else if (fs.existsSync(rootTsx)) {
    spawnCmd = process.execPath;
    spawnArgs = [rootTsx, serverEntry];
  } else {
    spawnCmd = 'npx';
    spawnArgs = ['tsx', serverEntry];
  }

  const child = spawn(spawnCmd, spawnArgs, {
    cwd: serverDir,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      WORKSPACE_DIR: options.workspaceDir || projectRoot,
      ...options.env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let serverStdout = '';
  let serverStderr = '';

  child.stdout?.on('data', (d) => {
    serverStdout += d.toString('utf8');
  });
  child.stderr?.on('data', (d) => {
    serverStderr += d.toString('utf8');
  });

  const stop = (): Promise<void> => {
    return new Promise((resolve) => {
      if (child.killed || child.exitCode !== null) {
        resolve();
        return;
      }

      let resolved = false;
      const finish = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      child.once('close', finish);
      child.once('exit', finish);

      // Attempt graceful SIGTERM first
      try {
        child.kill('SIGTERM');
      } catch {
        // already stopped
      }

      // Force SIGKILL if not stopped after 1500ms
      setTimeout(() => {
        if (!resolved) {
          try {
            child.kill('SIGKILL');
          } catch {
            // ignore
          }
          finish();
        }
      }, 1500);
    });
  };

  try {
    await waitForServerReady(baseUrl, readyEndpoint, readyTimeout);
  } catch (err: any) {
    await stop();
    throw new Error(
      `Failed to launch test server on port ${port}: ${err.message}\n` +
      `STDOUT: ${serverStdout.slice(-1000)}\n` +
      `STDERR: ${serverStderr.slice(-1000)}`
    );
  }

  return {
    port,
    baseUrl,
    pid: child.pid,
    process: child,
    stop,
  };
}

/**
 * Cleanly stops a running server instance
 */
export async function stopServer(instance: ServerInstance): Promise<void> {
  if (instance && typeof instance.stop === 'function') {
    await instance.stop();
  }
}
