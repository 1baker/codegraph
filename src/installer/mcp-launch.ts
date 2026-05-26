import * as fs from 'fs';
import * as path from 'path';

export interface McpLaunchConfig {
  type: 'stdio';
  command: string;
  args: string[];
}

interface ResolveOptions {
  env?: NodeJS.ProcessEnv;
  argv?: string[];
  execPath?: string;
  platform?: NodeJS.Platform;
  pathExists?: (p: string) => boolean;
}

const PACKAGE_NAME = '@colbymchenry/codegraph';
const DEFAULT_ARGS = ['serve', '--mcp'];

export function defaultMcpLaunchConfig(): McpLaunchConfig {
  return { type: 'stdio', command: 'codegraph', args: [...DEFAULT_ARGS] };
}

export function resolveMcpLaunchConfig(opts: ResolveOptions = {}): McpLaunchConfig {
  const env = opts.env ?? process.env;
  const argv = opts.argv ?? process.argv;
  const execPath = opts.execPath ?? process.execPath;
  const platform = opts.platform ?? process.platform;
  const pathExists = opts.pathExists ?? fs.existsSync;

  const override = configFromEnv(env);
  if (override) return override;

  const npx = isNpxInvocation(env, argv);
  const pathHit = findCommandOnPath('codegraph', env, platform, pathExists);
  if (pathHit && !(npx && isNpxTempPath(pathHit))) {
    return defaultMcpLaunchConfig();
  }

  if (npx) {
    return {
      type: 'stdio',
      command: platform === 'win32' ? 'npx.cmd' : 'npx',
      args: ['--yes', PACKAGE_NAME, ...DEFAULT_ARGS],
    };
  }

  const entry = argv[1];
  if (entry && isDurableCodeGraphEntry(entry, pathExists)) {
    return { type: 'stdio', command: execPath, args: [entry, ...DEFAULT_ARGS] };
  }

  return defaultMcpLaunchConfig();
}

function configFromEnv(env: NodeJS.ProcessEnv): McpLaunchConfig | null {
  const command = env.CODEGRAPH_MCP_COMMAND?.trim();
  if (!command) return null;
  let args = DEFAULT_ARGS;
  const rawArgs = env.CODEGRAPH_MCP_ARGS_JSON;
  if (rawArgs) {
    try {
      const parsed = JSON.parse(rawArgs);
      if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
        args = parsed;
      }
    } catch {
      // Ignore malformed overrides; the explicit command still wins.
    }
  }
  return { type: 'stdio', command, args };
}

function isNpxInvocation(env: NodeJS.ProcessEnv, argv: string[]): boolean {
  if (env.npm_command === 'exec') return true;
  if (env.npm_lifecycle_event === 'npx') return true;
  if (env._ && /(?:^|[\\/])npx(?:\.cmd)?$/.test(env._)) return true;
  return argv.some(isNpxTempPath);
}

function isNpxTempPath(value: string): boolean {
  return /[\\/]_npx[\\/]/.test(value.replace(/\\/g, '/'));
}

function isDurableCodeGraphEntry(entry: string, pathExists: (p: string) => boolean): boolean {
  const normalized = entry.replace(/\\/g, '/');
  if (isNpxTempPath(normalized)) return false;
  if (!pathExists(entry)) return false;
  return /\/dist\/bin\/codegraph\.js$/.test(normalized) ||
    /\/bin\/codegraph(?:\.cmd)?$/.test(normalized);
}

function findCommandOnPath(
  command: string,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  pathExists: (p: string) => boolean,
): string | null {
  const pathEnv = env.PATH ?? env.Path ?? '';
  if (!pathEnv) return null;
  const extensions = platform === 'win32'
    ? (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
    : [''];

  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of extensions) {
      const candidate = path.join(dir, platform === 'win32' ? command + ext.toLowerCase() : command);
      if (pathExists(candidate)) return candidate;
      if (platform === 'win32') {
        const upper = path.join(dir, command + ext.toUpperCase());
        if (pathExists(upper)) return upper;
      }
    }
  }
  return null;
}
