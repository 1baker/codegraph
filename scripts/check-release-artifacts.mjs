#!/usr/bin/env node
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseDir = path.join(root, 'release');
const npmDir = path.join(releaseDir, 'npm');
const requiredBundleSuffixes = [
  'lib/dist/db/schema.sql',
  'lib/dist/skills/codegraph-workspace/SKILL.md',
  'lib/dist/skills/codegraph-workspace/agents/openai.yaml',
];
const requiredNpmFiles = [
  'lib/dist/db/schema.sql',
  'lib/dist/skills/codegraph-workspace/SKILL.md',
  'lib/dist/skills/codegraph-workspace/agents/openai.yaml',
];

const mode = process.argv.includes('--bundles-only')
  ? 'bundles'
  : process.argv.includes('--npm-only')
    ? 'npm'
    : 'all';

function fail(message) {
  console.error(`[release-artifacts] ${message}`);
  process.exit(1);
}

function listFiles(dir) {
  try {
    return fs.readdirSync(dir).sort();
  } catch {
    return [];
  }
}

function archiveEntries(archive) {
  if (archive.endsWith('.tar.gz')) {
    return execFileSync('tar', ['-tzf', archive], { encoding: 'utf-8' })
      .split(/\r?\n/)
      .filter(Boolean);
  }
  if (archive.endsWith('.zip')) {
    return execFileSync('unzip', ['-Z1', archive], { encoding: 'utf-8' })
      .split(/\r?\n/)
      .filter(Boolean);
  }
  return [];
}

function checkBundles() {
  const archives = listFiles(releaseDir)
    .filter((file) => /^codegraph-.+\.(tar\.gz|zip)$/.test(file))
    .map((file) => path.join(releaseDir, file));
  if (archives.length === 0) {
    fail(`no platform archives found in ${releaseDir}`);
  }

  for (const archive of archives) {
    const entries = archiveEntries(archive);
    for (const suffix of requiredBundleSuffixes) {
      if (!entries.some((entry) => entry.endsWith(suffix))) {
        fail(`${path.basename(archive)} is missing ${suffix}`);
      }
    }
    if (!entries.some((entry) => /lib\/dist\/extraction\/wasm\/.+\.wasm$/.test(entry))) {
      fail(`${path.basename(archive)} is missing extraction wasm files`);
    }
  }
  console.log(`[release-artifacts] bundles ok (${archives.length} archives)`);
}

function checkNpmPackages() {
  const packageDirs = listFiles(npmDir)
    .filter((file) => file.startsWith('codegraph-'))
    .map((file) => path.join(npmDir, file))
    .filter((file) => fs.statSync(file).isDirectory());
  if (packageDirs.length === 0) {
    fail(`no platform npm package dirs found in ${npmDir}`);
  }

  for (const packageDir of packageDirs) {
    const packageJson = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf-8'));
    if (!Array.isArray(packageJson.files) || !packageJson.files.includes('lib')) {
      fail(`${path.basename(packageDir)} package.json must include "lib" in files`);
    }
    for (const rel of requiredNpmFiles) {
      if (!fs.existsSync(path.join(packageDir, rel))) {
        fail(`${path.basename(packageDir)} is missing ${rel}`);
      }
    }
    const wasmDir = path.join(packageDir, 'lib/dist/extraction/wasm');
    if (!listFiles(wasmDir).some((file) => file.endsWith('.wasm'))) {
      fail(`${path.basename(packageDir)} is missing extraction wasm files`);
    }
  }

  const mainPackage = path.join(npmDir, 'main', 'package.json');
  if (!fs.existsSync(mainPackage)) {
    fail('main npm shim package is missing');
  }
  const main = JSON.parse(fs.readFileSync(mainPackage, 'utf-8'));
  const optional = main.optionalDependencies ?? {};
  for (const packageDir of packageDirs) {
    const packageJson = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf-8'));
    if (!optional[packageJson.name]) {
      fail(`main package optionalDependencies is missing ${packageJson.name}`);
    }
  }
  console.log(`[release-artifacts] npm packages ok (${packageDirs.length} platform packages)`);
}

if (mode === 'bundles' || mode === 'all') checkBundles();
if (mode === 'npm' || mode === 'all') checkNpmPackages();
