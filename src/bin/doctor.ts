import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import CodeGraph from '../index';
import { isInitialized } from '../directory';
import { ALL_TARGETS, getTarget } from '../installer/targets/registry';
import type { AgentTarget, Location } from '../installer/targets/types';
import { CODEGRAPH_SKILL_NAME, codeGraphSkillInstallPath } from '../installer/skills';

export type DoctorStatus = 'pass' | 'warn' | 'fail' | 'skip';

export interface DoctorOptions {
  projectPath?: string;
  location?: Location;
  target?: string;
  mcp?: boolean;
  timeoutMs?: number;
  cliPath?: string;
}

export interface DoctorCheck {
  status: DoctorStatus;
  message: string;
}

export interface DoctorReport {
  ok: boolean;
  status: DoctorStatus;
  version: string;
  runtime: {
    status: DoctorStatus;
    node: string;
    platform: string;
    arch: string;
    executable: string;
    cliPath: string | null;
    packageRoot: string;
    runtimeRoot: string;
    origin: 'source' | 'built' | 'bundle-or-platform-package';
  };
  productAssets: {
    status: DoctorStatus;
    checks: Record<string, DoctorCheck>;
  };
  skill: {
    status: DoctorStatus;
    path: string;
    name: string;
    hasSkillMd: boolean;
    hasOpenAiMetadata: boolean;
  };
  project: {
    status: DoctorStatus;
    path: string;
    initialized: boolean;
    stale: boolean;
    pendingChanges: { added: number; modified: number; removed: number };
    skippedFiles: Array<{ path: string; size: number; reason: 'size_exceeded' }>;
    stats?: {
      fileCount: number;
      nodeCount: number;
      edgeCount: number;
      dbSizeBytes: number;
    };
  };
  mcp: {
    status: DoctorStatus;
    skipped: boolean;
    toolsListed: number;
    statusToolOk: boolean;
    message: string;
  };
  agentConfigs: Array<{
    id: string;
    displayName: string;
    location: Location;
    status: DoctorStatus;
    installed: boolean;
    configured: boolean;
    configPath?: string;
    message: string;
  }>;
}

type JsonRpcMessage = {
  jsonrpc?: string;
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { message?: string };
};

const STATUS_RANK: Record<DoctorStatus, number> = {
  pass: 0,
  skip: 0,
  warn: 1,
  fail: 2,
};

export async function collectDoctorReport(options: DoctorOptions = {}): Promise<DoctorReport> {
  const packageRoot = findPackageRoot(__dirname);
  const packageJsonPath = path.join(packageRoot, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as { version?: string };
  const runtimeRoot = fs.existsSync(path.join(packageRoot, 'dist', 'bin', 'codegraph.js'))
    ? path.join(packageRoot, 'dist')
    : path.resolve(__dirname, '..');
  const origin = detectOrigin(packageRoot, runtimeRoot);
  const productAssets = collectProductAssetChecks(packageRoot, runtimeRoot);
  const skill = collectSkillCheck();
  const project = await collectProjectCheck(options.projectPath);
  const location = options.location ?? 'global';
  const agentConfigs = collectAgentConfigChecks(options.target, location);
  const mcp = options.mcp === false
    ? {
        status: 'skip' as DoctorStatus,
        skipped: true,
        toolsListed: 0,
        statusToolOk: false,
        message: 'MCP launch smoke skipped by --no-mcp',
      }
    : await collectMcpCheck({
        projectPath: project.path,
        initialized: project.initialized,
        timeoutMs: options.timeoutMs,
        cliPath: options.cliPath,
      });

  const status = maxStatus([
    productAssets.status,
    skill.status,
    project.status,
    mcp.status,
    ...agentConfigs.map((entry) => entry.status),
  ]);

  return {
    ok: status !== 'fail',
    status,
    version: packageJson.version ?? 'unknown',
    runtime: {
      status: 'pass',
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      executable: process.execPath,
      cliPath: process.argv[1] ?? null,
      packageRoot,
      runtimeRoot,
      origin,
    },
    productAssets,
    skill,
    project,
    mcp,
    agentConfigs,
  };
}

export function renderDoctorText(report: DoctorReport): string {
  const lines: string[] = [
    'CodeGraph Doctor',
    '',
    `${label(report.status)} Overall: ${report.status}`,
    `${label(report.runtime.status)} Runtime: ${report.runtime.node} ${report.runtime.platform}/${report.runtime.arch} (${report.runtime.origin})`,
    `${label(report.productAssets.status)} Product assets: ${summarizeAssetChecks(report.productAssets.checks)}`,
    `${label(report.skill.status)} Skill: ${report.skill.path}`,
    `${label(report.project.status)} Project: ${report.project.path}`,
    `${label(report.mcp.status)} MCP: ${report.mcp.message}`,
    '',
    'Agent Configs:',
  ];

  for (const agent of report.agentConfigs) {
    const suffix = agent.configPath ? ` (${agent.configPath})` : '';
    lines.push(`  ${label(agent.status)} ${agent.id}: ${agent.message}${suffix}`);
  }

  lines.push('');
  if (report.project.initialized) {
    const stats = report.project.stats;
    if (stats) {
      lines.push(`Index: ${stats.fileCount} files, ${stats.nodeCount} nodes, ${stats.edgeCount} edges`);
    }
    if (report.project.skippedFiles.length > 0) {
      lines.push(`Skipped files: ${report.project.skippedFiles.length}`);
      for (const skipped of report.project.skippedFiles.slice(0, 5)) {
        lines.push(`  ${skipped.path} (${skipped.size} bytes, ${skipped.reason})`);
      }
    }
    if (report.project.stale) {
      const p = report.project.pendingChanges;
      lines.push(`Pending changes: added=${p.added} modified=${p.modified} removed=${p.removed}`);
    }
  }

  return lines.join('\n') + '\n';
}

function detectOrigin(packageRoot: string, runtimeRoot: string): DoctorReport['runtime']['origin'] {
  if (path.basename(runtimeRoot) !== 'dist') return 'source';
  const parent = path.dirname(packageRoot);
  if (
    fs.existsSync(path.join(parent, 'node')) ||
    fs.existsSync(path.join(parent, 'node.exe')) ||
    fs.existsSync(path.join(parent, 'bin', process.platform === 'win32' ? 'codegraph.cmd' : 'codegraph'))
  ) {
    return 'bundle-or-platform-package';
  }
  return 'built';
}

function collectProductAssetChecks(packageRoot: string, runtimeRoot: string): DoctorReport['productAssets'] {
  const builtAssets = {
    schema: path.join(runtimeRoot, 'db', 'schema.sql'),
    wasmDir: path.join(runtimeRoot, 'extraction', 'wasm'),
    skill: path.join(runtimeRoot, 'skills', CODEGRAPH_SKILL_NAME, 'SKILL.md'),
    openai: path.join(runtimeRoot, 'skills', CODEGRAPH_SKILL_NAME, 'agents', 'openai.yaml'),
  };
  const sourceAssets = {
    schema: path.join(packageRoot, 'src', 'db', 'schema.sql'),
    wasmDir: path.join(packageRoot, 'src', 'extraction', 'wasm'),
    skill: path.join(packageRoot, '.agents', 'skills', CODEGRAPH_SKILL_NAME, 'SKILL.md'),
    openai: path.join(packageRoot, '.agents', 'skills', CODEGRAPH_SKILL_NAME, 'agents', 'openai.yaml'),
  };
  const assets = fs.existsSync(builtAssets.schema) ? builtAssets : sourceAssets;
  const wasmCount = countWasmFiles(assets.wasmDir);
  const checks: Record<string, DoctorCheck> = {
    schema: fileCheck(assets.schema),
    wasm: wasmCount > 0
      ? { status: 'pass', message: `${wasmCount} grammar wasm files found` }
      : { status: 'fail', message: `No grammar wasm files found in ${assets.wasmDir}` },
    skill: fileCheck(assets.skill),
    openaiMetadata: fileCheck(assets.openai),
  };

  return {
    status: maxStatus(Object.values(checks).map((check) => check.status)),
    checks,
  };
}

function collectSkillCheck(): DoctorReport['skill'] {
  const skillPath = codeGraphSkillInstallPath();
  const skillMd = path.join(skillPath, 'SKILL.md');
  const openai = path.join(skillPath, 'agents', 'openai.yaml');
  const hasSkillMd = fs.existsSync(skillMd);
  const hasOpenAiMetadata = fs.existsSync(openai);
  return {
    status: hasSkillMd && hasOpenAiMetadata ? 'pass' : 'fail',
    path: skillPath,
    name: CODEGRAPH_SKILL_NAME,
    hasSkillMd,
    hasOpenAiMetadata,
  };
}

async function collectProjectCheck(pathArg?: string): Promise<DoctorReport['project']> {
  const projectPath = resolveProjectPath(pathArg);
  if (!isInitialized(projectPath)) {
    return {
      status: 'fail',
      path: projectPath,
      initialized: false,
      stale: false,
      pendingChanges: { added: 0, modified: 0, removed: 0 },
      skippedFiles: [],
    };
  }

  const cg = await CodeGraph.open(projectPath);
  try {
    const stats = cg.getStats();
    const changes = cg.getChangedFiles();
    const skippedFiles = cg.getFiles()
      .filter((file) => file.errors?.some((err) => err.code === 'size_exceeded'))
      .map((file) => ({ path: file.path, size: file.size, reason: 'size_exceeded' as const }));
    const pendingChanges = {
      added: changes.added.length,
      modified: changes.modified.length,
      removed: changes.removed.length,
    };
    const stale = pendingChanges.added + pendingChanges.modified + pendingChanges.removed > 0;
    return {
      status: stale ? 'fail' : skippedFiles.length > 0 ? 'warn' : 'pass',
      path: projectPath,
      initialized: true,
      stale,
      pendingChanges,
      skippedFiles,
      stats: {
        fileCount: stats.fileCount,
        nodeCount: stats.nodeCount,
        edgeCount: stats.edgeCount,
        dbSizeBytes: stats.dbSizeBytes,
      },
    };
  } finally {
    cg.destroy();
  }
}

function collectAgentConfigChecks(targetFlag: string | undefined, location: Location): DoctorReport['agentConfigs'] {
  const explicit = targetFlag !== undefined && targetFlag !== '' && targetFlag !== 'auto';
  const targets = resolveDoctorTargets(targetFlag, location);
  if (targets.length === 0) {
    return [{
      id: 'auto',
      displayName: 'Auto-detected agents',
      location,
      status: 'warn',
      installed: false,
      configured: false,
      message: 'No installed or configured agents detected',
    }];
  }

  return targets.map((target) => {
    if (!target.supportsLocation(location)) {
      return {
        id: target.id,
        displayName: target.displayName,
        location,
        status: explicit ? 'fail' : 'skip',
        installed: false,
        configured: false,
        message: `${target.displayName} does not support ${location} installs`,
      };
    }

    const detection = target.detect(location);
    let status: DoctorStatus;
    let message: string;
    if (detection.alreadyConfigured) {
      status = 'pass';
      message = 'CodeGraph is configured';
    } else if (explicit) {
      status = 'fail';
      message = 'CodeGraph is not configured';
    } else if (detection.installed) {
      status = 'warn';
      message = 'Agent appears installed but CodeGraph is not configured';
    } else {
      status = 'skip';
      message = 'Agent not detected';
    }

    return {
      id: target.id,
      displayName: target.displayName,
      location,
      status,
      installed: detection.installed,
      configured: detection.alreadyConfigured,
      configPath: detection.configPath,
      message,
    };
  });
}

function resolveDoctorTargets(targetFlag: string | undefined, location: Location): AgentTarget[] {
  if (!targetFlag || targetFlag === 'auto') {
    return ALL_TARGETS.filter((target) => {
      if (!target.supportsLocation(location)) return false;
      const detection = target.detect(location);
      return detection.installed || detection.alreadyConfigured;
    });
  }
  if (targetFlag === 'none') return [];
  if (targetFlag === 'all') return [...ALL_TARGETS];

  const targets: AgentTarget[] = [];
  const unknown: string[] = [];
  for (const id of targetFlag.split(',').map((s) => s.trim()).filter(Boolean)) {
    const target = getTarget(id);
    if (target) targets.push(target);
    else unknown.push(id);
  }
  if (unknown.length > 0) {
    throw new Error(`Unknown --target id(s): ${unknown.join(', ')}`);
  }
  return targets;
}

async function collectMcpCheck(options: {
  projectPath: string;
  initialized: boolean;
  timeoutMs?: number;
  cliPath?: string;
}): Promise<DoctorReport['mcp']> {
  if (!options.initialized) {
    return {
      status: 'fail',
      skipped: false,
      toolsListed: 0,
      statusToolOk: false,
      message: 'Skipped MCP status smoke because the project is not initialized',
    };
  }

  try {
    const result = await runMcpSmoke(options.projectPath, options.timeoutMs ?? 7000, options.cliPath);
    return {
      status: 'pass',
      skipped: false,
      toolsListed: result.toolsListed,
      statusToolOk: result.statusToolOk,
      message: `MCP launched, listed ${result.toolsListed} tools, and answered codegraph_status`,
    };
  } catch (err) {
    return {
      status: 'fail',
      skipped: false,
      toolsListed: 0,
      statusToolOk: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function runMcpSmoke(projectPath: string, timeoutMs: number, cliPath?: string): Promise<{
  toolsListed: number;
  statusToolOk: boolean;
}> {
  const codegraphBin = cliPath ?? process.argv[1];
  if (!codegraphBin) {
    throw new Error('Cannot locate the current codegraph CLI path for MCP smoke');
  }

  const child = spawn(process.execPath, [
    codegraphBin,
    'serve',
    '--mcp',
    '--no-watch',
    '--path',
    projectPath,
  ], {
    cwd: projectPath,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      CODEGRAPH_NO_WATCH: '1',
      CODEGRAPH_PPID_POLL_MS: '0',
    },
  });

  const stderr: string[] = [];
  const pending = new Map<string | number, {
    resolve: (msg: JsonRpcMessage) => void;
    reject: (error: Error) => void;
  }>();
  let stdoutBuffer = '';

  child.stderr.on('data', (chunk) => {
    stderr.push(String(chunk));
  });
  child.stdout.on('data', (chunk) => {
    stdoutBuffer += String(chunk);
    let newline = stdoutBuffer.indexOf('\n');
    while (newline >= 0) {
      const line = stdoutBuffer.slice(0, newline).trim();
      stdoutBuffer = stdoutBuffer.slice(newline + 1);
      if (line) handleMcpLine(line, pending, child, projectPath);
      newline = stdoutBuffer.indexOf('\n');
    }
  });

  child.on('exit', () => {
    for (const { reject } of pending.values()) {
      reject(new Error(`MCP server exited early${stderr.length ? `: ${stderr.join('').trim()}` : ''}`));
    }
    pending.clear();
  });

  const timer = setTimeout(() => {
    child.kill('SIGTERM');
    for (const { reject } of pending.values()) {
      reject(new Error(`MCP smoke timed out after ${timeoutMs}ms`));
    }
    pending.clear();
  }, timeoutMs);

  function send(message: JsonRpcMessage): void {
    if (!child.stdin) throw new Error('MCP server stdin is unavailable');
    child.stdin.write(JSON.stringify(message) + '\n');
  }

  function waitFor(id: string | number): Promise<JsonRpcMessage> {
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
  }

  try {
    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        rootUri: pathToFileURL(projectPath).href,
      },
    });
    await assertMcpOk(await waitFor(1), 'initialize');
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });

    send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const toolsResponse = await assertMcpOk(await waitFor(2), 'tools/list');
    const tools = (toolsResponse.result as { tools?: unknown[] } | undefined)?.tools ?? [];
    if (!Array.isArray(tools) || tools.length === 0) {
      throw new Error('MCP tools/list returned no tools');
    }

    send({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'codegraph_status', arguments: { projectPath } },
    });
    await assertMcpOk(await waitFor(3), 'codegraph_status');
    return { toolsListed: tools.length, statusToolOk: true };
  } finally {
    clearTimeout(timer);
    child.stdin.end();
    child.kill('SIGTERM');
  }
}

function handleMcpLine(
  line: string,
  pending: Map<string | number, { resolve: (msg: JsonRpcMessage) => void; reject: (error: Error) => void }>,
  child: ReturnType<typeof spawn>,
  projectPath: string,
): void {
  let parsed: JsonRpcMessage;
  try {
    parsed = JSON.parse(line) as JsonRpcMessage;
  } catch {
    return;
  }

  if (parsed.method === 'roots/list' && parsed.id !== undefined) {
    if (!child.stdin) return;
    child.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: parsed.id,
      result: { roots: [{ uri: pathToFileURL(projectPath).href, name: path.basename(projectPath) }] },
    }) + '\n');
    return;
  }

  if (parsed.id !== undefined) {
    const waiter = pending.get(parsed.id);
    if (waiter) {
      pending.delete(parsed.id);
      waiter.resolve(parsed);
    }
  }
}

async function assertMcpOk(response: JsonRpcMessage, labelText: string): Promise<JsonRpcMessage> {
  if (response.error) {
    throw new Error(`MCP ${labelText} failed: ${response.error.message ?? 'unknown error'}`);
  }
  if (!('result' in response)) {
    throw new Error(`MCP ${labelText} returned no result`);
  }
  return response;
}

function resolveProjectPath(pathArg?: string): string {
  const absolutePath = path.resolve(pathArg || process.cwd());
  if (isInitialized(absolutePath)) return absolutePath;

  let current = absolutePath;
  const root = path.parse(current).root;
  while (current !== root) {
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
    if (isInitialized(current)) return current;
  }
  return absolutePath;
}

function findPackageRoot(start: string): string {
  let current = path.resolve(start);
  const root = path.parse(current).root;
  while (true) {
    const packageJson = path.join(current, 'package.json');
    if (fs.existsSync(packageJson)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(packageJson, 'utf-8')) as { name?: string };
        if (parsed.name === '@colbymchenry/codegraph') return current;
      } catch {
        // Keep walking.
      }
    }
    if (current === root) break;
    current = path.dirname(current);
  }
  return path.resolve(process.cwd());
}

function fileCheck(filePath: string): DoctorCheck {
  return fs.existsSync(filePath)
    ? { status: 'pass', message: filePath }
    : { status: 'fail', message: `Missing ${filePath}` };
}

function countWasmFiles(dir: string): number {
  try {
    return fs.readdirSync(dir).filter((file) => file.endsWith('.wasm')).length;
  } catch {
    return 0;
  }
}

function maxStatus(statuses: DoctorStatus[]): DoctorStatus {
  return statuses.reduce<DoctorStatus>(
    (worst, status) => STATUS_RANK[status] > STATUS_RANK[worst] ? status : worst,
    'pass',
  );
}

function label(status: DoctorStatus): string {
  switch (status) {
    case 'pass': return '[PASS]';
    case 'warn': return '[WARN]';
    case 'fail': return '[FAIL]';
    case 'skip': return '[SKIP]';
  }
}

function summarizeAssetChecks(checks: Record<string, DoctorCheck>): string {
  return Object.entries(checks)
    .map(([name, check]) => `${name}=${check.status}`)
    .join(' ');
}
