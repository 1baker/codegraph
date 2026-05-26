# RUNBOOK.md

## Turn 4 | 2026-05-26

Plan: `docs/dev/plans/0002-2026-05-26-product-deployment-plan.md`

Actions:

- Added the repo-local `codegraph-workspace` skill and matching
  `agents/openai.yaml` metadata.
- Installed a matching user-level copy under
  `/home/ecochran76/.agents/skills/codegraph-workspace/` for immediate local
  agent use.
- Opened roadmap lane `P02 | Product Deployment`.
- Added a full deployment plan covering product contract, skill packaging,
  installer integration, installed-runtime smokes, index lifecycle,
  cross-agent validation, release packaging, docs, workstation rollout, and
  rollback.

Validation:

- Confirmed the repo-local and user-level skill copies are byte-identical.
- Ran a lightweight metadata check for `SKILL.md` and `agents/openai.yaml`.
- The bundled skill validator was not run because this Python environment lacks
  `PyYAML`.

Notes:

- The skill is usable locally now, but it is not yet a release artifact. Plan
  0002 treats build/bundle/npm packaging plus installer install/uninstall support
  as release blockers.

## Turn 5 | 2026-05-26

Plan: `docs/dev/plans/0002-2026-05-26-product-deployment-plan.md`

Actions:

- Added `docs/dev/product-deployment-contract.md` as the release artifact and
  installed-surface contract for Plan 0002.
- Replaced the inline `copy-assets` command with `scripts/copy-assets.mjs` and
  made builds copy `codegraph-workspace` into
  `dist/skills/codegraph-workspace/`.
- Added `src/installer/skills.ts` to install/update/uninstall the shared
  `~/.agents/skills/codegraph-workspace` directory while preserving sibling
  user skills.
- Wired global `codegraph install` and `codegraph uninstall` to manage the
  shared skill, and updated npm `preuninstall` cleanup to remove it best-effort.
- Added `scripts/check-product-artifacts.mjs` plus CI coverage for the built
  skill/schema/WASM payload.
- Updated README, site install docs, site integrations docs, and CHANGELOG for
  the deployed skill surface.
- Added installer tests for skill install, idempotency, stale-update behavior,
  sibling preservation, uninstall, and clean uninstall.
- Updated oversized-source handling so skipped files are persisted with a
  `size_exceeded` warning and surfaced in CLI/MCP status instead of remaining
  permanent pending changes.

Validation:

- `npm run build`
- `npm run check:product-artifacts`
- `npx vitest run __tests__/installer-targets.test.ts`
- `npx vitest run __tests__/sync.test.ts`
- Built `dist` Codex global install smoke against a temp HOME created
  `config.toml`, `AGENTS.md`, and `~/.agents/skills/codegraph-workspace`, then
  uninstall removed all three CodeGraph-owned surfaces.

Notes:

- A first artifact check was launched before the build finished copying assets
  and failed as expected; rerunning after build passed.
- A first temp-HOME smoke wrapper used zsh's read-only `status` variable after
  all checks had already returned `0`; rerunning with `exit_code` produced a
  clean pass.

## Turn 6 | 2026-05-26

Plan: `docs/dev/plans/0002-2026-05-26-product-deployment-plan.md`

Actions:

- Added `codegraph doctor` with text and JSON output for runtime/package
  origin, product assets, installed skill metadata, selected agent config,
  index freshness, and MCP `codegraph_status` launch smoke.
- Added `__tests__/doctor.test.ts` covering JSON shape, missing-install
  failures, temp-HOME Codex config detection, and a real built-CLI MCP smoke.
- Added `scripts/check-release-artifacts.mjs` plus release-workflow gates for
  platform archives and generated npm packages before publish.
- Updated README, site docs, product contract, roadmap, plan, and changelog for
  the doctor/release-artifact surfaces.

Validation:

- `npm run build`
- `npx vitest run __tests__/doctor.test.ts`
- `node dist/bin/codegraph.js doctor /home/ecochran76/workspace.local/codegraph --target=codex --location=global --json`

## Turn 7 | 2026-05-26

Plan: `docs/dev/plans/0002-2026-05-26-product-deployment-plan.md`

Actions:

- Built release-candidate archives with the production script for:
  `darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`, `win32-x64`, and
  `win32-arm64`.
- Generated `release/SHA256SUMS`.
- Ran `scripts/pack-npm.sh`, producing six generated platform npm packages and
  the main shim package under `release/npm/`.
- Ran the generated artifact checker against the real archives and generated
  npm packages.
- Extracted `release/codegraph-linux-x64.tar.gz` and smoke-tested the generated
  artifact from temp HOME installs for both Codex and opencode.

Validation:

- `npm run check:release-artifacts` passed:
  six archives and six generated platform npm packages contained schema, WASM,
  and `codegraph-workspace` payloads.
- Generated Linux x64 artifact, Codex temp HOME:
  install created `~/.codex/config.toml`, `~/.codex/AGENTS.md`, and
  `~/.agents/skills/codegraph-workspace`; `codegraph doctor --json` reported
  `ok=true`, `origin=bundle-or-platform-package`, `mcp=pass`, ten tools listed,
  `skill=pass`, and `agent=pass`.
- Generated Linux x64 artifact, opencode temp HOME:
  install created `~/.config/opencode/opencode.jsonc`,
  `~/.config/opencode/AGENTS.md`, and
  `~/.agents/skills/codegraph-workspace`; `codegraph doctor --json` reported
  `ok=true`, `origin=bundle-or-platform-package`, `mcp=pass`, ten tools listed,
  `skill=pass`, and `agent=pass`.

Notes:

- The release directory is intentionally gitignored. The current local dry-run
  output is about 1.3 GB.
- Windows archives were built and inspected as archive/package payloads, but
  PowerShell installer execution on a real Windows VM is still open.

## Turn 8 | 2026-05-26

Plan: `docs/dev/plans/0002-2026-05-26-product-deployment-plan.md`

Actions:

- Installed the generated Linux x64 artifact into the standalone layout:
  `~/.codegraph/versions/v0.9.4-plan0002-local`,
  `~/.codegraph/current`, and `~/.local/bin/codegraph`.
- Re-ran real Codex global install from that artifact; Codex config now launches
  `command = "codegraph"` with `args = ["serve", "--mcp"]`.
- Synced pending active repo indexes for `agent-browser` and `odollo`.
- Ran retrieval smokes using the installed artifact against:
  `previews` (small), `graphiti` (medium), and `openclaw.git` (large).
- Verified fresh-agent skill visibility outside the repo with
  `codex debug prompt-input`: `codegraph-workspace` appears from
  `r1/codegraph-workspace/SKILL.md`.
- Added `CODEGRAPH_DOWNLOAD_BASE` support to `install.sh` and `install.ps1`.
- Fixed a real PowerShell installer bug where local variable `$home` collided
  with PowerShell's read-only `$HOME`.
- Ran Windows PowerShell validation against the generated win32 x64 archive
  served from a local release base.

Validation:

- `codegraph doctor /home/ecochran76/workspace.local/codegraph --target=codex --location=global --json`
  from `~/.local/bin/codegraph` reported `ok=true`,
  `origin=bundle-or-platform-package`, `mcp=pass`, ten tools listed,
  `skill=pass`, and Codex agent config `pass`.
- Active repo statuses after sync:
  `codegraph`, `agent-browser`, `agent-policies`, `codex-wake`, `graphiti`,
  `odollo`, `openclaw.git`, `previews`, `slack-export`, and `litscout` all
  reported `pending=0`; `graphiti` reported one skipped oversized file;
  `ragmail` was absent at the planned path.
- Retrieval smokes returned results for `previews` query `server`, `graphiti`
  query `Graphiti`, and `openclaw.git` query `OpenClaw`.
- `sh -n install.sh`
- PowerShell parsed `install.ps1` with `[scriptblock]::Create(...)`.
- PowerShell standalone smoke downloaded `codegraph-win32-x64.zip` from the
  local release base, verified SHA256, extracted it, initialized and indexed a
  native Windows temp project, installed Codex config and
  `codegraph-workspace` under a temp Windows home, and `doctor --json` reported
  `ok=true`, `origin=bundle-or-platform-package`, `mcp=pass`, ten tools listed,
  `skill=pass`, and Codex agent config `pass`.

Notes:

- The first Windows doctor attempt used a WSL UNC project and hit a SQLite
  `database is locked` error. The passing validation uses a native Windows temp
  project, which is the correct PowerShell installer surface.

## Turn 9 | 2026-05-26

Plan: `docs/dev/plans/0002-2026-05-26-product-deployment-plan.md`

Actions:

- Ran the final release-candidate validation gate.
- Updated the production `picomatch` dependency to `^4.0.4`, rebuilt release
  artifacts, regenerated checksums, and reran generated-artifact smokes.
- Closed Plan 0002 and Roadmap P02 as release-ready without publishing,
  tagging, pushing, or triggering GitHub Actions.

Validation:

- `npm ci`
- `npm run build`
- `npm run check:product-artifacts`
- `npm run check:release-artifacts`
- `npm audit --omit=dev --json` reported zero production vulnerabilities.
- Full `npm audit --json` still reports dev-only Vitest/Vite toolchain findings;
  those dependencies are outside the generated release payload.
- `npm test`
- Root package guard: `npm pack --dry-run --json` failed intentionally with
  "Refusing to pack or publish the repository root package."
- `sh -n install.sh`
- `CODEGRAPH_INSTALL_DIR=/ sh install.sh --uninstall` refused the unsafe path.
- PowerShell parsed `install.ps1` with `[scriptblock]::Create(...)`.
- `git diff --check`

## Turn 1 | 2026-05-25

Plan: `docs/dev/plans/0001-2026-05-25-codex-install-readiness.md`

Actions:

- Installed repo-local policy modules under `docs/dev/policies/`.
- Added `AGENTS.md` policy entry wiring to the installed policy modules.
- Added `ROADMAP.md` lane `P01 | Codex Install Readiness`.
- Captured Codex install-readiness recommendations and validation gates in the active plan.

Notes:

- The selector initially chose `standalone-library`; after the plan surface existed, it upgraded this repo to `repo-product-engineering`, so the missing product-engineering modules were installed as a follow-up patch.
- The planning audit should now treat the plan as wired through the roadmap and runbook.

## Turn 2 | 2026-05-25

Plan: `docs/dev/plans/0001-2026-05-25-codex-install-readiness.md`

Actions:

- Added durable MCP launch resolution for installer targets, including Codex TOML config, Cursor `--path`, Claude JSON, opencode JSONC, and Hermes YAML.
- Updated Codex temp-HOME install tests, simulated `npx` launch tests, MCP launch resolution tests, and Node version tests.
- Aligned source runtime metadata on Node `>=22.5.0 <25.0.0`, synced the lockfile root version, and removed stale `better-sqlite3` typing metadata.
- Added root-package pack/publish guard, CI, standalone installer checksum verification, and unsafe uninstall path guards.
- Refreshed Codex-oriented README/site docs, demoted `CLAUDE.md` to legacy guidance, and updated the changelog.
- Stabilized `npm test` by running `__tests__/extraction.test.ts` in bounded batches; the single-file extraction suite can still OOM if run monolithically under current V8/WebAssembly behavior.

Validation:

- `npm ci`
- `npm run build`
- `npm test`
- `npx vitest run __tests__/installer-targets.test.ts __tests__/node-version-check.test.ts`
- `npx vitest run __tests__/mcp-roots.test.ts __tests__/security.test.ts`
- `npm pack --dry-run --json` fails intentionally with the root-package guard.
- `sh -n install.sh`
- `CODEGRAPH_INSTALL_DIR=/ sh install.sh --uninstall` refuses the unsafe path.
- Temp-HOME Codex install, simulated `npx` Codex install, and Codex reinstall idempotency smokes passed from built `dist/`.

Notes:

- `install.ps1` was edited but not run locally because neither `pwsh` nor `powershell` is available in this environment.
- A mistaken smoke wrapper briefly ran a real Codex install once; it was immediately undone with the built uninstall path. After cleanup, `~/.codex/AGENTS.md` was absent and `~/.codex/config.toml` had no CodeGraph MCP block.

## Turn 3 | 2026-05-25

Plan: `docs/dev/plans/0001-2026-05-25-codex-install-readiness.md`

Actions:

- Installed the real Codex global target with `node dist/bin/codegraph.js install --target=codex --location=global --yes`.
- Verified `~/.codex/config.toml` contains `[mcp_servers.codegraph]` with the built-checkout launch command and `~/.codex/AGENTS.md` contains the CodeGraph guidance block.
- Indexed the curated sibling batch: `agent-skills`, `codex-wake`, `graphiti`, `openclaw.git`, `previews`, `receipts`, and `slack-export`.
- Added `.codegraph/` to each selected repo's `.git/info/exclude` so indexes remain local workstation state.
- Ran a live MCP stdio smoke using the installed command: `initialize` returned tool capabilities and `codegraph_status` returned `previews` index stats.
- Ran retrieval smokes against `agent-skills`, `codex-wake`, `slack-export`, and `previews`.

Index Evidence:

- `agent-skills`: 225 files, 4,271 nodes, 10,784 edges, 12.16 MB, up to date.
- `codex-wake`: 23 files, 505 nodes, 1,279 edges, 1.57 MB, up to date.
- `graphiti`: 293 files, 6,275 nodes, 14,449 edges, 13.20 MB, usable with one pending oversized tracked Python file.
- `openclaw.git`: 16,214 files, 214,047 nodes, 578,770 edges, 433.18 MB, up to date.
- `previews`: 24 files, 558 nodes, 1,358 edges, 1.63 MB, up to date.
- `receipts`: 77 files, 1,983 nodes, 7,163 edges, 6.65 MB, up to date.
- `slack-export`: 115 files, 2,805 nodes, 8,349 edges, 9.73 MB, up to date.

Notes:

- `graphiti/mcp_server/src/graphiti_runtime_cli.py` is 1.9 MB, above CodeGraph's 1 MB source-file cutoff. `codegraph sync` indexes zero nodes for it and status still reports one pending added file.
- Existing unrelated dirty state remains in `codex-wake`, `graphiti`, and `openclaw.git`; no tracked files were edited there for the indexes.
