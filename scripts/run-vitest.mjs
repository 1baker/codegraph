#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const vitest = require.resolve('vitest/vitest.mjs');
// Tree-sitter WASM grammars can exhaust V8 Zone memory under optimized WASM tiers.
const wasmFlags = ['--liftoff-only', '--no-wasm-tier-up'];
const execArgs = wasmFlags.filter((flag) => !process.execArgv.includes(flag));

const result = spawnSync(process.execPath, [...execArgs, vitest, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
