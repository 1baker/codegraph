#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const runVitest = join(__dirname, 'run-vitest.mjs');
const extraArgs = process.argv.slice(2);

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

run('all tests except extraction.test.ts', [
  'run',
  '--exclude',
  '__tests__/extraction.test.ts',
]);

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
