# Plan 0002 | Product Deployment Plan

State: CLOSED
Lane: P02
Date: 2026-05-26
Owner: Codex
Policy profile: repo-product-engineering

## Goal

Ship CodeGraph as a complete multi-agent product, not just a working local
checkout: installable CLI, MCP server, agent instructions, agent skill, indexed
workspace workflow, release artifacts, validation evidence, and rollback path.

## Product Scope

CodeGraph's deployable product surface is:

- `codegraph` CLI and library API.
- `codegraph serve --mcp` server and `codegraph_*` tools.
- Multi-agent installer targets: Claude Code, Cursor, Codex CLI, opencode, and
  Hermes Agent.
- Agent guidance surfaces: MCP initialize instructions, per-agent instruction
  files, Cursor rules, and the `codegraph-workspace` skill.
- Per-project `.codegraph/` indexes as local derived state.
- Standalone platform bundles plus npm shim/platform packages.
- Documentation, release notes, and operator smoke commands.

Non-product state:

- Per-workstation `.codegraph/` databases.
- Tenant or customer runtime data.
- Ad hoc user-level skill copies that are not produced by the installer.
- Manual local checkout wiring that cannot be reproduced from a release.

## Current State

- Plan 0001 is closed and Codex global MCP install is live on this workstation.
- The release workflow builds platform bundles, checks generated product
  payloads, publishes GitHub Release assets with `SHA256SUMS`, and publishes
  generated npm shim/platform packages.
- The repo root package is guarded against accidental `npm pack` or
  `npm publish`; the generated release packages are the canonical npm artifacts.
- `codegraph-workspace` now exists in `.agents/skills/codegraph-workspace/`,
  builds into `dist/skills/codegraph-workspace/`, and has a matching user-level
  installed copy under `~/.agents/skills/`.
- Global install/uninstall now manages the shared skill directory separately
  from target MCP config and instruction-file writes.
- `package.json` currently publishes `dist`, `scripts`, and `README.md` from
  the source package; generated platform packages include only `node`, `lib`,
  and `bin`; the generated npm shim includes only `npm-shim.js` and `README.md`.
- `scripts/build-bundle.sh` stages only `dist`, `package.json`,
  `package-lock.json`, production dependencies, vendored Node, and launchers.
- Current validation covers Linux source builds/tests, Codex MCP smokes,
  temp-HOME skill install/uninstall, `codegraph doctor` against the built and
  installed artifact surfaces, and real Windows PowerShell installer execution.
- Several sibling repos are indexed and useful. Graphiti now reports up to date
  with an explicit skipped oversized-file caveat.

## Progress Update | 2026-05-26

- Track A is started: `docs/dev/product-deployment-contract.md` now defines the
  release artifact manifest, product payload, installed agent surfaces,
  local-state boundary, and verification gates.
- Track B is partially implemented: `npm run build` copies
  `.agents/skills/codegraph-workspace/` into
  `dist/skills/codegraph-workspace/`; global installs copy that product asset
  into `~/.agents/skills/codegraph-workspace`; global uninstalls and npm
  `preuninstall` remove only the CodeGraph-owned skill directory.
- Track E has focused coverage for the new surface: installer tests now cover
  skill install, idempotent reinstall, stale skill update, sibling-skill
  preservation, uninstall, and clean uninstall.
- Track F is started: `npm run check:product-artifacts` verifies the built
  schema, WASM grammars, and skill payload; CI runs it after build.
- Track G is started: README, site install docs, site integration docs, and the
  changelog now mention the `codegraph-workspace` deployed skill surface.
- Track D is partially implemented: oversized source files are recorded as
  intentionally skipped with `size_exceeded` warnings so status can become clean
  while still surfacing the caveat in CLI JSON, CLI text, and MCP status output.
- Track C is partially implemented: `codegraph doctor` checks runtime/package
  origin, built product assets, installed skill metadata, selected agent config,
  index freshness, and a real MCP `codegraph_status` launch smoke, with JSON
  output for release validation.
- Track F has a generated-artifact guard: `scripts/check-release-artifacts.mjs`
  verifies platform archives and generated platform npm packages include schema,
  WASM, and `codegraph-workspace`; the release workflow runs it before
  publishing.
- Release-candidate artifact inspection has current Linux evidence: all six
  platform archives were built by `scripts/build-bundle.sh`, `SHA256SUMS` was
  generated, `scripts/pack-npm.sh` produced six platform packages plus the main
  shim, and `npm run check:release-artifacts` passed against the real generated
  output.
- Installed-artifact smokes have current Linux evidence from the generated
  `codegraph-linux-x64.tar.gz`: temp-HOME Codex and opencode global installs
  both created their config/instructions plus the shared skill, and
  `codegraph doctor --json` passed with `productAssets=pass`, `mcp=pass`, ten
  listed tools, and agent config `pass`.
- Workstation rollout is installed from the generated Linux x64 artifact:
  `~/.codegraph/current` points to `v0.9.4-plan0002-local`,
  `~/.local/bin/codegraph` points at that artifact, Codex global MCP config now
  launches `codegraph serve --mcp`, and `codegraph doctor --json` passes from
  the installed bundle against this repo.
- Active indexed repo evidence is current for the available repo set:
  `codegraph`, `agent-browser`, `agent-policies`, `codex-wake`, `graphiti`,
  `odollo`, `openclaw.git`, `previews`, `slack-export`, and `litscout` all
  report `pending=0`; `graphiti` reports one explicit skipped oversized file;
  `ragmail` is absent at `/home/ecochran76/workspace.local/ragmail`.
- Fresh-agent skill visibility is verified with `codex debug prompt-input` from
  outside the repo: `codegraph-workspace` appears from the user skill root
  (`r1/codegraph-workspace/SKILL.md`).
- Windows PowerShell validation is current against the generated win32 x64
  archive served from a local release base: `install.ps1` downloaded the zip,
  verified `SHA256SUMS`, extracted it, initialized and indexed a native Windows
  temp project, installed Codex config plus the shared skill under a temp
  Windows home, and `codegraph doctor --json` passed with
  `productAssets=pass`, `mcp=pass`, ten listed tools, `skill=pass`, and agent
  config `pass`.
- Production dependency audit is clean after updating `picomatch` to `^4.0.4`;
  `npm audit --omit=dev --json` reports zero vulnerabilities.

## Deployment Principle

Every product claim must be reproducible from a release artifact, not from this
specific checkout. A deployed agent should receive:

1. A launchable CodeGraph MCP server.
2. Instructions for when to use it.
3. A skill that triggers for indexed-repo work.
4. A clear index lifecycle: initialize, sync, status, and cleanup.
5. A smoke path that proves the installed artifact, not just source, works.

## Critical Path

1. Freeze the public deployment contract and artifact manifest.
2. Productize the `codegraph-workspace` skill in source, bundles, npm packages,
   install, uninstall, and docs.
3. Add deterministic install and MCP smoke commands that future releases can run
   without ad hoc JSON-RPC scripts.
4. Close known readiness gaps: oversized-file pending status, PowerShell
   validation, generated package contents, and release-note discipline.
5. Validate a release candidate from generated artifacts across agents and
   operating systems.
6. Cut the release through the GitHub Actions release workflow.
7. Roll out on this workstation and record post-install evidence for active
   repos.

## Parallel Work Plan

### Track A | Product Contract And Artifact Manifest

Priority: P0

Tasks:

- Add a durable product deployment contract under `docs/dev/` naming every
  artifact that must ship in a release.
- Define the support matrix by agent and install location:
  - MCP config support.
  - instruction-file support.
  - skill support.
  - project-local surfaces.
  - uninstall behavior.
- Decide whether skills are installed by default, behind a flag, or only for
  detected skill-aware runtimes. Default recommendation: install by default
  where a conventional user skill directory exists, and report `unsupported`
  where it does not.
- Define the installed-skill source of truth. Default recommendation:
  `.agents/skills/codegraph-workspace/` is canonical source; release packages
  carry a copied product asset; user-level installed copies are generated by the
  installer.
- Document that `.codegraph/` indexes are never release artifacts.

Acceptance criteria:

- A product contract document exists and names the exact files/packages that
  carry CodeGraph's CLI, MCP server, instructions, skill, and release metadata.
- The support matrix distinguishes "not supported yet" from "not applicable."
- The contract is referenced from README/site install docs or the deployment
  plan closeout.

### Track B | Skill Packaging And Installer Integration

Priority: P0

Tasks:

- Add a build step that copies `.agents/skills/codegraph-workspace/` into a
  deterministic runtime asset path, for example `dist/skills/codegraph-workspace/`.
- Update source package `files` and generated package scripts so the skill ships
  in:
  - source package install path,
  - standalone platform bundles,
  - generated platform npm packages,
  - generated main npm shim if needed for zero-install skill inspection.
- Add installer support for skill writes separate from MCP config writes. Keep
  this separate enough that targets with no skill convention can skip cleanly.
- Add safe install semantics:
  - create/update only the CodeGraph-owned skill directory,
  - preserve sibling user skills,
  - idempotent re-run returns `unchanged`,
  - uninstall removes only the CodeGraph-owned skill directory.
- Install `codegraph-workspace` into known skill roots for Codex/OpenAI-style
  agents on this machine family, starting with `~/.agents/skills/`.
- If a target has a distinct skill directory, add that target-specific writer
  only after verifying the convention.
- Ensure `agents/openai.yaml` is included and validated.

Acceptance criteria:

- `npm run build` produces the skill asset in `dist`.
- `scripts/build-bundle.sh` archives include the skill asset.
- `scripts/pack-npm.sh` generated packages include the skill where the installed
  runtime expects to find it.
- `codegraph install --target=codex --location=global --yes` installs or updates
  the skill in the expected user skill root on a temp HOME.
- `codegraph uninstall --target=codex --location=global --yes` removes only the
  CodeGraph skill.
- Installer target tests cover install, idempotency, uninstall, and sibling
  preservation for skill directories.

### Track C | Installed Runtime Doctor And Smoke Commands

Priority: P0

Tasks:

- Add `codegraph doctor` or `codegraph smoke` commands for common deployment
  checks:
  - CLI version and runtime Node version.
  - package origin: source, npm shim, platform bundle, or standalone install.
  - MCP initialize/tool-list smoke.
  - `codegraph_status` smoke against a selected repo.
  - installed skill presence and metadata.
  - agent config presence for selected targets.
- Keep machine-specific paths out of generic output unless the operator asks for
  verbose JSON.
- Add a JSON mode so release workflow, docs, and future agents can consume the
  smoke result deterministically.
- Reuse the same command in install docs and release validation.

Acceptance criteria:

- A single command can prove that the installed artifact launches MCP and sees
  a known indexed repo.
- The command distinguishes "not initialized", "stale index", "missing skill",
  "missing agent config", and "MCP launch failed."
- Tests cover at least JSON shape, failure status, and temp-HOME agent config
  detection.

### Track D | Index Lifecycle And Oversized-File Readiness

Priority: P0

Tasks:

- Fix or intentionally productize oversized-file behavior. Options:
  - mark oversized files as skipped so `status` can be up to date with a skipped
    file warning,
  - make the cutoff configurable per project,
  - or improve the sync report so permanent pending files are not mistaken for
    ordinary stale indexes.
- Add `status --json` fields for skipped/oversized files if they do not already
  exist.
- Add docs for index lifecycle:
  - `codegraph init -i`,
  - `codegraph sync`,
  - watcher lag,
  - git hook fallback,
  - `.codegraph/` local-state handling,
  - uninit and cleanup.
- Keep tenant/workstation data out of tracked repo files.

Acceptance criteria:

- Graphiti can either report up to date with an explicit skipped-file caveat, or
  the remaining oversized file is split below the cutoff and indexed.
- `codegraph status` is no longer ambiguous for permanently skipped files.
- Docs tell operators what to do when `status` reports skipped or pending files.

### Track E | Cross-Agent Validation Matrix

Priority: P0

Tasks:

- Build a validation matrix covering:
  - Codex global install.
  - Cursor global and local install, preserving the `--path` cwd workaround.
  - Claude global and local install, including legacy cleanup.
  - opencode JSONC install/uninstall round trips.
  - Hermes YAML install/uninstall round trips.
- Validate each target for:
  - MCP config write.
  - instruction write.
  - skill write or explicit unsupported status.
  - idempotent reinstall.
  - uninstall reversal.
  - sibling config preservation.
- Add at least one installed MCP smoke for Codex and one non-Codex target where
  local tooling permits it.
- Keep Windows-specific assertions gated and validate them on the real Windows
  VM before claiming Windows support.

Acceptance criteria:

- `__tests__/installer-targets.test.ts` covers the expanded skill surface for
  every target that claims skill support.
- Source validation passes: `npm ci`, `npm run build`, `npm test`.
- Temp-HOME installs prove Codex and at least one other target can install,
  reinstall, uninstall, and leave only expected files.
- Windows PowerShell installer validation is either passed and recorded or
  explicitly listed as a release blocker.

### Track F | Release Packaging And Supply-Chain Gates

Priority: P0

Tasks:

- Extend CI to check product asset packaging:
  - skill files exist in `dist`,
  - platform bundle contains the skill,
  - generated npm package contains the skill or intentionally does not with a
    documented reason,
  - root package guard still fails as expected.
- Add release-candidate dry-run scripts for generated package inspection without
  publishing.
- Verify standalone installer checksum behavior remains intact after packaging
  changes.
- Add changelog entries for:
  - skill-aware installs,
  - install/uninstall behavior,
  - status/oversized-file behavior,
  - any Node/runtime or release-artifact changes.
- Keep the release workflow as the only publish path. Do not run `npm publish`
  manually.

Acceptance criteria:

- CI catches a missing skill asset before release.
- Generated release package inspection is deterministic and documented.
- `CHANGELOG.md` has a release-ready entry from the user's perspective.
- Release workflow remains manually triggered and reads the package version.

### Track G | Documentation, Site, And Agent-Facing Guidance

Priority: P1

Tasks:

- Update README and site install docs to explain:
  - what gets installed,
  - which agents are supported,
  - what the skill does,
  - how to initialize a repo,
  - how to verify install health,
  - how to uninstall without deleting indexes.
- Keep the three MCP guidance surfaces synchronized:
  - `src/mcp/server-instructions.ts`,
  - `src/installer/instructions-template.ts`,
  - `.cursor/rules/codegraph.mdc`.
- Add skill guidance to docs without duplicating the entire skill body.
- Add troubleshooting entries for:
  - missing MCP tools,
  - stale indexes,
  - oversized skipped files,
  - agent config exists but agent was not restarted,
  - Node/runtime mismatch for source installs.

Acceptance criteria:

- A new user can install, initialize one repo, verify MCP, and understand the
  installed skill from README alone.
- Site docs match README for install commands and support claims.
- No docs imply a release behavior that is only true for this checkout.

### Track H | Workstation Rollout And Indexed-Repo Adoption

Priority: P1

Tasks:

- After release-candidate validation, reinstall on this workstation from the
  same artifact path users will consume.
- Re-index or sync the active repo set and record status evidence:
  - `codegraph`,
  - `agent-browser`,
  - `agent-policies`,
  - `codex-wake`,
  - `graphiti`,
  - `odollo`,
  - `openclaw.git`,
  - `previews`,
  - `ragmail`,
  - `slack-export`,
  - `litscout`,
  - other active repos only when a structural retrieval need exists.
- Keep `.codegraph/` in local excludes.
- Run at least three real retrieval smokes:
  - one small repo,
  - one medium repo,
  - one large repo.
- Confirm the installed `codegraph-workspace` skill is available to fresh
  agents on the machine.

Acceptance criteria:

- Workstation install evidence names the artifact/version used.
- Active indexed repos have current status records and any skipped-file caveats.
- A fresh-agent smoke demonstrates that the skill triggers or is explicitly
  invokable.

## Release Candidate Gate

Before cutting a release:

- `npm ci`
- `npm run build`
- `npm test`
- installer target tests for all agent targets
- temp-HOME Codex install/reinstall/uninstall smoke
- temp-HOME skill install/reinstall/uninstall smoke
- generated bundle/package inspection
- `codegraph doctor --json` MCP initialize/status smoke from generated artifact
- standalone shell installer syntax and unsafe-path checks
- PowerShell installer validation on Windows, or release remains blocked
- changelog entry and docs updated
- `git diff --check`

## Rollback Plan

- `codegraph uninstall --target=<target> --location=<location> --yes` removes
  agent config/instructions/skill surfaces created by the installer.
- `codegraph uninit <repo>` removes a repo's `.codegraph/` index.
- Standalone installs should retain their existing uninstall path and checksum
  verified replacement behavior.
- npm users can install the prior known-good version with
  `npm install -g @colbymchenry/codegraph@<version>`.
- Release rollback should prefer publishing a patch release over mutating an
  existing tag or npm version.

## Non-Goals

- Do not publish, tag, push, or trigger the release workflow from this plan.
- Do not promise support for agent skill directories that have not been verified.
- Do not index every sibling repo blindly as a product requirement.
- Do not store tenant/runtime data in tracked repo files.
- Do not replace compiler, test, lint, or runtime validation with CodeGraph
  structural results.

## Definition Of Done

- The product deployment contract exists and is reflected in README/site docs.
- `codegraph-workspace` ships from release artifacts and is installed/uninstalled
  through `codegraph install` and `codegraph uninstall`.
- Installed-artifact smoke commands prove CLI, MCP, agent config, and skill
  readiness.
- Oversized-file status is no longer ambiguous for indexed repos.
- CI and release-candidate checks cover skill/package contents.
- Cross-agent installer behavior is validated and documented.
- A release-ready changelog entry exists.
- Workstation rollout evidence proves the released artifact works on active
  indexed repos.

## Closeout | 2026-05-26

Plan 0002 is closed as release-ready, not published. The non-goals still apply:
no tag, push, npm publish, or GitHub release workflow trigger was performed.

Completion evidence:

- Product contract, README, site docs, changelog, roadmap, and runbook are
  updated for the deployable product surface.
- `npm run build` copies schema, WASM grammars, and
  `codegraph-workspace` into `dist/`.
- `scripts/build-bundle.sh` produced all six platform archives, and
  `scripts/pack-npm.sh` produced six generated platform npm packages plus the
  main shim.
- `npm run check:release-artifacts` passed against the real generated archives
  and generated npm packages.
- Linux generated-artifact smokes passed for Codex and opencode from temp
  homes.
- Workstation Codex now launches the generated Linux x64 artifact through
  `~/.local/bin/codegraph`.
- Windows PowerShell validation passed against the generated win32 x64 archive
  using a local release base and temp Windows home.
- Production dependency audit passed with zero vulnerabilities after the
  `picomatch` runtime dependency update.
- Active indexed repos available on this machine report current status; Graphiti
  reports its oversized file as an explicit skipped-file caveat instead of
  permanent pending state.
- Fresh Codex prompt-input outside this repo sees the installed
  `codegraph-workspace` skill from the user skill root.
- Final validation set passed: `npm ci`, `npm run build`,
  `npm run check:product-artifacts`, `npm run check:release-artifacts`,
  `npm audit --omit=dev --json`, `npm test`, root package guard, shell
  installer safety check, PowerShell parse, generated-artifact `doctor --json`,
  and `git diff --check`.

Known caveat:

- Full dev dependency audit still reports findings in the Vitest/Vite toolchain
  (`@vitest/mocker`, `esbuild`, `postcss`, `rollup`, `vite`, `vite-node`,
  `vitest`). The deployable release payload gate is clean because production
  audit excludes dev dependencies.
