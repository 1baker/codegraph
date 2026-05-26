/**
 * Productized agent-skill install surface.
 *
 * The skill source lives in `.agents/skills/codegraph-workspace/` while built
 * and bundled runtimes load the copied asset from `dist/skills/`. The installer
 * owns only the `codegraph-workspace` destination directory and leaves sibling
 * user skills untouched.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { WriteResult } from './targets/types';

export const CODEGRAPH_SKILL_NAME = 'codegraph-workspace';

export function codeGraphSkillInstallPath(): string {
  return path.join(os.homedir(), '.agents', 'skills', CODEGRAPH_SKILL_NAME);
}

export function codeGraphSkillSourcePath(): string {
  const candidates = [
    process.env.CODEGRAPH_SKILL_SOURCE,
    path.join(__dirname, '..', 'skills', CODEGRAPH_SKILL_NAME),
    path.join(__dirname, '..', '..', '.agents', 'skills', CODEGRAPH_SKILL_NAME),
    path.join(process.cwd(), '.agents', 'skills', CODEGRAPH_SKILL_NAME),
  ].filter((p): p is string => !!p);

  for (const candidate of candidates) {
    if (isSkillDir(candidate)) return candidate;
  }

  throw new Error(
    `Could not find bundled ${CODEGRAPH_SKILL_NAME} skill. Run "npm run build" and reinstall CodeGraph.`,
  );
}

export function installCodeGraphSkill(): WriteResult['files'][number] {
  const source = codeGraphSkillSourcePath();
  const dest = codeGraphSkillInstallPath();
  const existed = pathExistsNoFollow(dest);

  if (existed && directoriesEqual(source, dest)) {
    return { path: dest, action: 'unchanged' };
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(source, dest, { recursive: true, dereference: false });
  return { path: dest, action: existed ? 'updated' : 'created' };
}

export function uninstallCodeGraphSkill(): WriteResult['files'][number] {
  const dest = codeGraphSkillInstallPath();
  if (!pathExistsNoFollow(dest)) {
    return { path: dest, action: 'not-found' };
  }
  fs.rmSync(dest, { recursive: true, force: true });
  return { path: dest, action: 'removed' };
}

function isSkillDir(dir: string): boolean {
  try {
    const stat = fs.statSync(dir);
    return stat.isDirectory() && fs.existsSync(path.join(dir, 'SKILL.md'));
  } catch {
    return false;
  }
}

function pathExistsNoFollow(p: string): boolean {
  try {
    fs.lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

function directoriesEqual(left: string, right: string): boolean {
  if (!pathExistsNoFollow(right)) return false;

  let leftStat: fs.Stats;
  let rightStat: fs.Stats;
  try {
    leftStat = fs.lstatSync(left);
    rightStat = fs.lstatSync(right);
  } catch {
    return false;
  }

  if (leftStat.isSymbolicLink() || rightStat.isSymbolicLink()) {
    try {
      return fs.realpathSync(left) === fs.realpathSync(right);
    } catch {
      return false;
    }
  }
  if (leftStat.isDirectory() !== rightStat.isDirectory()) return false;
  if (leftStat.isFile() !== rightStat.isFile()) return false;

  if (leftStat.isFile()) {
    if (leftStat.size !== rightStat.size) return false;
    return fs.readFileSync(left).equals(fs.readFileSync(right));
  }

  if (!leftStat.isDirectory()) return false;

  const leftEntries = fs.readdirSync(left).sort();
  const rightEntries = fs.readdirSync(right).sort();
  if (leftEntries.length !== rightEntries.length) return false;
  for (let i = 0; i < leftEntries.length; i += 1) {
    const leftEntry = leftEntries[i];
    const rightEntry = rightEntries[i];
    if (leftEntry === undefined || rightEntry === undefined || leftEntry !== rightEntry) return false;
    if (!directoriesEqual(path.join(left, leftEntry), path.join(right, rightEntry))) {
      return false;
    }
  }
  return true;
}
