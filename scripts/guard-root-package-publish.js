#!/usr/bin/env node
'use strict';

if (process.env.CODEGRAPH_ALLOW_ROOT_PACKAGE_PUBLISH === '1') {
  process.exit(0);
}

process.stderr.write([
  'Refusing to pack or publish the repository root package.',
  '',
  'CodeGraph releases publish generated thin-installer packages from',
  'release/npm/ after scripts/pack-npm.sh assembles the shim and',
  'per-platform packages. Packing or publishing this checkout directly',
  'would produce a source/dev package that is not the release artifact.',
  '',
  'Use the GitHub Actions Release workflow, or set',
  'CODEGRAPH_ALLOW_ROOT_PACKAGE_PUBLISH=1 only for an intentional local',
  'diagnostic pack.',
  '',
].join('\n'));
process.exit(1);
