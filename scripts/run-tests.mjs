#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const runVitest = join(__dirname, 'run-vitest.mjs');
const extraArgs = process.argv.slice(2);
const broadBatchSize = Number.parseInt(process.env.CODEGRAPH_TEST_BATCH_SIZE ?? '8', 10);

function run(label, args) {
  console.log(`\n[codegraph test] ${label}`);
  const result = spawnSync(process.execPath, [runVitest, ...args], {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (extraArgs.length > 0) {
  run('vitest', ['run', ...extraArgs]);
  process.exit(0);
}

function listTestFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTestFiles(abs));
    } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
      files.push(relative(repoRoot, abs).replaceAll('\\', '/'));
    }
  }

  return files.sort();
}

function chunk(files, size) {
  const chunks = [];
  for (let index = 0; index < files.length; index += size) {
    chunks.push(files.slice(index, index + size));
  }
  return chunks;
}

function escapeRegExp(value) {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

function listTopLevelDescribeNames(file) {
  const source = readFileSync(join(repoRoot, file), 'utf8');
  const names = [];
  const describePattern = /^  describe\((['"`])(.+?)\1,/gm;
  let match;

  while ((match = describePattern.exec(source)) !== null) {
    names.push(match[2]);
  }

  return names;
}

const broadTestFiles = listTestFiles(join(repoRoot, '__tests__')).filter(
  (file) => file !== '__tests__/extraction.test.ts' && file !== '__tests__/resolution.test.ts',
);
const broadBatches = chunk(broadTestFiles, Number.isFinite(broadBatchSize) && broadBatchSize > 0 ? broadBatchSize : 8);

for (const [index, files] of broadBatches.entries()) {
  run(`all tests except extraction.test.ts (${index + 1}/${broadBatches.length})`, ['run', ...files]);
}

const resolutionDescribeNames = listTopLevelDescribeNames('__tests__/resolution.test.ts');
for (const [index, name] of resolutionDescribeNames.entries()) {
  if (name === 'Local-variable receiver-type inference (#1108)') {
    const localReceiverSlices = [
      'resolves a local-variable method call',
      'Ruby: builds receiver\\.method',
      'TypeScript: infers a typed-parameter receiver',
      'infers a typed-parameter receiver, disambiguating same-named methods',
      'resolves a PascalCase method call',
    ];

    for (const [sliceIndex, pattern] of localReceiverSlices.entries()) {
      run(
        `resolution.test.ts (${index + 1}/${resolutionDescribeNames.length}) ${name} slice ${sliceIndex + 1}/${localReceiverSlices.length}`,
        ['run', '__tests__/resolution.test.ts', '-t', pattern],
      );
    }
    continue;
  }

  run(`resolution.test.ts (${index + 1}/${resolutionDescribeNames.length}) ${name}`, [
    'run',
    '__tests__/resolution.test.ts',
    '-t',
    escapeRegExp(name),
  ]);
}

const extractionBatches = [
  [
    'extraction core languages',
    'Language Detection|Language Support|TypeScript Extraction|Arrow Function Export Extraction|Type Alias Extraction|Exported Variable Extraction|File Node Extraction|Python Extraction|Go Extraction|Rust Extraction|Java Extraction|C# Extraction|PHP Extraction|Swift Extraction|Kotlin Extraction|Dart Extraction',
  ],
  [
    'extraction imports and Delphi fixtures',
    'Import Extraction|Pascal / Delphi Extraction|DFM/FMX Extraction',
  ],
  [
    'extraction indexing and path behavior',
    'Full Indexing|Path Normalization|Directory Exclusion|Git Submodules|Nested non-submodule git repos',
  ],
  [
    'extraction late language coverage',
    'Scala Extraction|Vue Extraction|Instantiates \\+ Decorates edge extraction|Lua Extraction|Luau Extraction',
  ],
];

for (const [label, pattern] of extractionBatches) {
  run(label, ['run', '__tests__/extraction.test.ts', '-t', pattern]);
}
