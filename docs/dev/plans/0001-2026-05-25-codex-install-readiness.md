# Plan 0001 | Codex Install Readiness

State: CLOSED
Lane: P01
Date: 2026-05-25
Owner: Codex
Policy profile: repo-product-engineering

## Goal

Make CodeGraph safe and useful to install for Codex-driven work across sibling repos under `/home/ecochran76/workspace.local`.

## Current State

- Repo-local policies are now installed under `docs/dev/policies/`, with `AGENTS.md` as the policy entrypoint.
- Codex global config is installed with a durable MCP command pointing at this built checkout: `/home/ecochran76/.nvm/versions/node/v24.14.0/bin/node /home/ecochran76/workspace.local/codegraph/dist/bin/codegraph.js serve --mcp`.
- `.codegraph/` indexes were created for the curated first sibling batch: `agent-skills`, `codex-wake`, `graphiti`, `openclaw.git`, `previews`, `receipts`, and `slack-export`.
- `.codegraph/` is excluded locally through each selected repo's `.git/info/exclude`, keeping indexes as workstation-local state.
- The sibling workspace contains many likely beneficiaries, including `agent-browser`, `agent-skills`, `buffer-cli`, `codex-wake`, `graphiti`, `litscout`, `odollo`, `openclaw.git`, `previews`, `receipts`, `slack-export`, and `soylei-website`.
- Local Node is `v24.14.0`; source runtime metadata is now aligned on `>=22.5.0 <25.0.0`, matching the `node:sqlite` floor.
- `package.json` and the root `package-lock.json` now both report version `0.9.4`.
- `npm pack --dry-run --json` from the repo root now fails intentionally with a root-package guard so the release-generated npm package remains the only publish path.
- Codex global install, simulated `npx` install, reinstall idempotency, and live MCP launch smokes pass from built `dist/`.
- `README.md`, `CLAUDE.md`, `AGENTS.md`, and site docs have been refreshed for Codex-first install guidance while keeping Claude support scoped.
- Full `npm test` now passes through a bounded runner; running `__tests__/extraction.test.ts` as one monolithic Vitest file still OOMs under current V8/WebAssembly behavior.
- `install.ps1` checksum and unsafe-path hardening is implemented but not locally executed because PowerShell is unavailable in this environment.

## Recommendation

CodeGraph is now useful for the selected active sibling projects on this machine. Keep the install scoped to Codex and the curated indexes for now; do not broaden to every sibling repo until there is a concrete task and a cross-project access policy.

The highest-value path is a Codex-first readiness slice:

- Keep install reliability for `codegraph install --target=codex --location=global --yes` covered by temp-HOME tests and smoke commands.
- Keep source runtime requirements, package metadata, and docs aligned around the real Node floor.
- Keep accidental root-package publishing blocked by the guard and CI.
- Maintain the first batch and expand only when an active project needs structural retrieval.

## Progress Update | 2026-05-25

- Track A is implemented and locally validated for built `dist/`, simulated `npx`, and idempotent Codex re-runs.
- Track B is implemented and validated with `npm ci`, `npm run build`, and `npm test`.
- Track C is implemented for root-package guard, CI, shell installer hardening, and PowerShell script edits; PowerShell execution remains unverified locally.
- Track D is implemented for Codex-critical README/site guidance, `AGENTS.md`, legacy `CLAUDE.md`, and current Claude auto-allow tools.
- Track E is complete for the first batch: seven sibling repos were indexed, and query/context/MCP smokes proved usable retrieval.

## Indexed Repos | 2026-05-25

| Repo | Files | Nodes | Edges | DB Size | Status |
|---|---:|---:|---:|---:|---|
| `agent-skills` | 225 | 4,271 | 10,784 | 12.16 MB | Up to date |
| `codex-wake` | 23 | 505 | 1,279 | 1.57 MB | Up to date |
| `graphiti` | 293 | 6,275 | 14,449 | 13.20 MB | Usable; one tracked 1.9 MB Python file remains pending because it exceeds CodeGraph's 1 MB source-file cutoff |
| `openclaw.git` | 16,214 | 214,047 | 578,770 | 433.18 MB | Up to date |
| `previews` | 24 | 558 | 1,358 | 1.63 MB | Up to date |
| `receipts` | 77 | 1,983 | 7,163 | 6.65 MB | Up to date |
| `slack-export` | 115 | 2,805 | 8,349 | 9.73 MB | Up to date |

Backend for all indexed repos: `node:sqlite` with WAL.

## Closeout Recommendations

- Keep using the explicit Codex install path: `codegraph install --target=codex --location=global --yes`; avoid relying on `--target=auto` for Codex-first workstation setup.
- Keep `.codegraph/` as local state. Do not add these indexes to tracked repo files.
- For `graphiti`, either accept the pending oversized file status or fix CodeGraph's skipped-large-file accounting so files above `MAX_FILE_SIZE` do not remain permanently pending.
- Validate `install.ps1` on a real PowerShell environment before claiming Windows standalone installer coverage.
- Consider adding a first-class `codegraph doctor install` or `codegraph smoke --mcp` command so future installer audits do not need ad hoc JSON-RPC scripts.

## Non-Goals

- Do not remove all Claude support in the first slice. Keep it isolated and correct, but Codex is the target for this workstation.
- Do not index every sibling repo blindly. Some repos are large, archival, generated, or may contain operator state.
- Do not publish, tag, push, or run the release workflow as part of this plan.

## Track A | Codex-First Installer Reliability

Priority: P0

Tasks:

- Make non-interactive install safe when invoked through `npx @colbymchenry/codegraph`; `src/installer/index.ts` currently skips the PATH install prompt under `--yes` and assumes `codegraph` is already available.
- Verify Codex global install writes only the intended `~/.codex/config.toml` `[mcp_servers.codegraph]` block and the marked `~/.codex/AGENTS.md` section.
- Keep Codex global-only behavior explicit; `src/installer/targets/codex.ts` correctly reports no project-local config support.
- Prefer explicit Codex commands in operator docs: `codegraph install --target=codex --location=global --yes`.
- Add temp-HOME installer tests for Codex install, reinstall, uninstall, and `--print-config`.
- Confirm the MCP command written for Codex resolves to a durable executable after the installing process exits.

Acceptance criteria:

- A temp-HOME Codex install smoke passes from built `dist/`.
- Re-running the same Codex install is byte-stable or reports `unchanged`.
- A simulated `npx` launch cannot leave Codex config pointing at a missing `codegraph` binary.

## Track B | Runtime And Package Metadata

Priority: P0

Tasks:

- Resolve the Node floor mismatch across `package.json`, `package-lock.json`, `src/bin/node-version-check.ts`, docs, and `AGENTS.md`.
- If source execution truly requires `node:sqlite`, set the package engine and docs to Node `>=22.5 <25`; otherwise add a tested compatibility path for Node 20.
- Sync `package-lock.json` root version to `0.9.4`.
- Keep the Node 25 hard block, since the CLI already has explicit crash-prevention logic for that line.
- Update stale SQLite docs that still describe `better-sqlite3` or `node-sqlite3-wasm` fallback behavior.

Acceptance criteria:

- `npm ci`
- `npm run build`
- `npm test`
- A source-run smoke on supported Node opens a CodeGraph DB and reports `node:sqlite`.

## Track C | Release And Install Artifact Safety

Priority: P0

Tasks:

- Add a root-package guard so `npm publish` or `npm pack` from the repo root cannot accidentally publish an unusable non-bundled package.
- Add CI for at least install, build, tests, typecheck, and package artifact checks; `.github/workflows/` currently has release and site deploy workflows but no normal CI gate.
- Harden `install.sh` uninstall so an empty or unsafe `CODEGRAPH_INSTALL_DIR` cannot expand into a destructive `rm -rf`.
- Add SHA256 verification to `install.sh` and `install.ps1`, using the release workflow's published `SHA256SUMS`.
- Consider making `install.ps1` resolve latest through the GitHub release redirect path, matching the rate-limit-resistant shell installer.

Acceptance criteria:

- `npm pack --dry-run --json` either produces the intended release shim artifact or fails intentionally with a clear message.
- Standalone installers verify archive checksums before extraction.
- Installer uninstall refuses unsafe install paths.

## Track D | Codex-Oriented Guidance Cleanup

Priority: P1

Tasks:

- Make `AGENTS.md` the canonical Codex entrypoint and demote `CLAUDE.md` to legacy/Claude-specific guidance or regenerate it from the shared template.
- Replace Claude-specific "Explore agent" assumptions in README and benchmark docs where the intended consumer is now Codex.
- Keep `src/mcp/server-instructions.ts`, `src/installer/instructions-template.ts`, and `.cursor/rules/codegraph.mdc` aligned when MCP tool guidance changes.
- If Claude support remains, update its auto-allow list to include the current MCP tools, including `codegraph_explore`, `codegraph_files`, and `codegraph_trace`.

Acceptance criteria:

- Codex instructions mention Codex behavior and files, not Claude-only workflows.
- Claude-specific docs are clearly scoped to Claude support rather than general install guidance.
- Installer target tests cover any retained Claude compatibility paths.

## Track E | Cross-Repo Usefulness And Safety

Priority: P1

Tasks:

- Pick a first install/index batch from active sibling repos, starting with `agent-skills`, `codex-wake`, `graphiti`, `openclaw.git`, `previews`, `receipts`, and `slack-export`.
- Skip generated, archival, vendor, browser, and large external trees unless there is a concrete active task.
- Decide whether global Codex config should allow cross-project `projectPath` access everywhere, or whether CodeGraph needs an allowlist for this workstation.
- After installing, run `codegraph init` and `codegraph index` inside selected repos only.
- Verify `codegraph status` in each selected repo and record index size, file count, and backend.

Acceptance criteria:

- Codex can answer a real structural question in at least three selected sibling repos using CodeGraph MCP tools.
- No index is created in a repo that should remain out of scope.
- Any cross-project access policy is documented before broad indexing.

## Validation Matrix

- Installer unit coverage: `npx vitest run __tests__/installer-targets.test.ts __tests__/node-version-check.test.ts` passed.
- MCP/root safety coverage: `npx vitest run __tests__/mcp-roots.test.ts __tests__/security.test.ts` passed.
- Build and full tests: `npm run build` and `npm test` passed.
- Package artifact check: `npm pack --dry-run --json` fails intentionally with the root-package guard.
- Shell installer checks: `sh -n install.sh` passed; `CODEGRAPH_INSTALL_DIR=/ sh install.sh --uninstall` refuses the unsafe path.
- Codex smoke with temp HOME: built `dist/bin/codegraph.js install --target=codex --location=global --yes` passed under isolated `HOME`, then wrote the expected `~/.codex/config.toml` and `~/.codex/AGENTS.md`.
- Simulated `npx` Codex smoke: wrote `command = "npx"` and `args = ["--yes", "@colbymchenry/codegraph", "serve", "--mcp"]`.
- Codex reinstall smoke: second install was byte-stable for config and instructions.
- Live post-install check: real `~/.codex/config.toml` contains the CodeGraph MCP block; `~/.codex/AGENTS.md` contains the marker-delimited CodeGraph guidance.
- MCP launch smoke: spawned the installed command, sent `initialize`, and called `codegraph_status` for `previews`; the server returned tool capabilities and status.
- Retrieval smokes: `query`/`context` returned relevant structural results for `agent-skills`, `codex-wake`, `slack-export`, and `previews`.

## Definition Of Done

- Tracks A, B, and C are complete and validated.
- Track D has at least the Codex-critical docs and templates corrected.
- A first sibling-repo index batch is selected, indexed, and smoke-tested.
- The final closeout names which repos are actively benefiting from CodeGraph and which remain intentionally unindexed.
