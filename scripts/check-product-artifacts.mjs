#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const required = [
  'dist/db/schema.sql',
  'dist/skills/codegraph-workspace/SKILL.md',
  'dist/skills/codegraph-workspace/agents/openai.yaml',
];

let failed = false;
for (const rel of required) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[product-artifacts] missing ${rel}`);
    failed = true;
  }
}

const wasmDir = path.join(root, 'dist', 'extraction', 'wasm');
const wasmFiles = fs.existsSync(wasmDir)
  ? fs.readdirSync(wasmDir).filter((file) => file.endsWith('.wasm'))
  : [];
if (wasmFiles.length === 0) {
  console.error('[product-artifacts] missing dist/extraction/wasm/*.wasm');
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log(`[product-artifacts] ok (${wasmFiles.length} wasm grammars, codegraph-workspace skill)`);
