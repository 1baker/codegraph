#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true, dereference: false });
}

copyFile(
  path.join(root, 'src', 'db', 'schema.sql'),
  path.join(root, 'dist', 'db', 'schema.sql'),
);

const wasmSource = path.join(root, 'src', 'extraction', 'wasm');
const wasmDest = path.join(root, 'dist', 'extraction', 'wasm');
fs.mkdirSync(wasmDest, { recursive: true });
for (const file of fs.readdirSync(wasmSource)) {
  if (file.endsWith('.wasm')) {
    copyFile(path.join(wasmSource, file), path.join(wasmDest, file));
  }
}

copyDir(
  path.join(root, '.agents', 'skills', 'codegraph-workspace'),
  path.join(root, 'dist', 'skills', 'codegraph-workspace'),
);
