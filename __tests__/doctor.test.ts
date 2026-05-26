import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import CodeGraph from '../src/index';
import { collectDoctorReport } from '../src/bin/doctor';
import { getTarget } from '../src/installer/targets/registry';
import { installCodeGraphSkill } from '../src/installer/skills';

const BIN = path.join(__dirname, '..', 'dist', 'bin', 'codegraph.js');

function mkTmpDir(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `cg-doctor-${label}-`));
}

function setHome(dir: string): { restore: () => void } {
  const prev = {
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
    APPDATA: process.env.APPDATA,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
  };
  process.env.HOME = dir;
  process.env.USERPROFILE = dir;
  process.env.APPDATA = path.join(dir, '.config');
  process.env.XDG_CONFIG_HOME = path.join(dir, '.config');
  return {
    restore() {
      if (prev.HOME === undefined) delete process.env.HOME; else process.env.HOME = prev.HOME;
      if (prev.USERPROFILE === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = prev.USERPROFILE;
      if (prev.APPDATA === undefined) delete process.env.APPDATA; else process.env.APPDATA = prev.APPDATA;
      if (prev.XDG_CONFIG_HOME === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = prev.XDG_CONFIG_HOME;
    },
  };
}

async function initProject(dir: string): Promise<void> {
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'index.ts'), 'export function main() { return 1; }\n');
  const cg = await CodeGraph.init(dir, { index: true });
  cg.destroy();
}

describe('codegraph doctor', () => {
  let tmpHome: string;
  let tmpProject: string;
  let homeRestore: { restore: () => void };

  beforeEach(() => {
    tmpHome = mkTmpDir('home');
    tmpProject = mkTmpDir('project');
    homeRestore = setHome(tmpHome);
  });

  afterEach(() => {
    homeRestore.restore();
    fs.rmSync(tmpHome, { recursive: true, force: true });
    fs.rmSync(tmpProject, { recursive: true, force: true });
  });

  it('reports installed runtime, skill, agent config, and ready index in JSON shape', async () => {
    await initProject(tmpProject);
    installCodeGraphSkill();
    getTarget('codex')!.install('global', { autoAllow: true });

    const report = await collectDoctorReport({
      projectPath: tmpProject,
      target: 'codex',
      location: 'global',
      mcp: false,
    });

    expect(report.ok).toBe(true);
    expect(report.productAssets.status).toBe('pass');
    expect(report.skill.status).toBe('pass');
    expect(report.project.status).toBe('pass');
    expect(report.project.pendingChanges).toEqual({ added: 0, modified: 0, removed: 0 });
    expect(report.agentConfigs).toHaveLength(1);
    expect(report.agentConfigs[0]).toMatchObject({ id: 'codex', status: 'pass', configured: true });
  });

  it('dist CLI doctor launches MCP and answers codegraph_status', async () => {
    await initProject(tmpProject);
    installCodeGraphSkill();
    getTarget('codex')!.install('global', { autoAllow: true });

    const result = spawnSync(process.execPath, [
      BIN,
      'doctor',
      tmpProject,
      '--target=codex',
      '--location=global',
      '--json',
      '--timeout=7000',
    ], {
      encoding: 'utf-8',
      env: { ...process.env, CODEGRAPH_NO_WATCH: '1', CODEGRAPH_PPID_POLL_MS: '0' },
    });

    expect(result.status, result.stderr).toBe(0);
    const jsonStart = result.stdout.indexOf('{');
    expect(jsonStart).toBeGreaterThanOrEqual(0);
    const report = JSON.parse(result.stdout.slice(jsonStart));
    expect(report.ok).toBe(true);
    expect(report.mcp).toMatchObject({ status: 'pass', statusToolOk: true });
    expect(report.mcp.toolsListed).toBeGreaterThan(0);
  });

  it('distinguishes missing skill and uninitialized project as failures', async () => {
    const report = await collectDoctorReport({
      projectPath: tmpProject,
      target: 'codex',
      location: 'global',
      mcp: false,
    });

    expect(report.ok).toBe(false);
    expect(report.skill.status).toBe('fail');
    expect(report.project).toMatchObject({ status: 'fail', initialized: false });
    expect(report.agentConfigs[0]).toMatchObject({ id: 'codex', status: 'fail', configured: false });
  });
});
