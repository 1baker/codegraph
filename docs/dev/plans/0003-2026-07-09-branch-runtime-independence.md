# Plan 0003 | Branch And Runtime Independence

State: CLOSED
Lane: P03
Date: 2026-07-09
Owner: Codex
Policy profile: repo-product-engineering

## Goal

Make local CodeGraph development compatible with two long-lived operator needs:

- keep local changes indefinitely while periodically rebasing onto upstream
  improvements; and
- keep the installed `codegraph` runtime independent of the development repo
  directory.

## Current State

- The active checkout is `/home/ecochran76/workspace.local/codegraph`.
- Local `main` currently points at the rebased local stack and tracks
  `cochran/main`, reporting a large ahead/behind divergence.
- `origin/main` is the upstream project at
  `https://github.com/colbymchenry/codegraph.git`.
- `cochran` is the operator fork at
  `https://github.com/CochranResearchGroup/codegraph.git`.
- A backup branch exists at `backup/main-before-rebase-upstream-20260708`.
- A published reconciliation branch exists at
  `cochran/rebase/upstream-20260707`.
- The active shell command is still coupled to the repo:
  `/home/ecochran76/.local/bin/codegraph -> /home/ecochran76/workspace.local/codegraph/dist/bin/codegraph.js`.

This is workable for a short repair slice but is not the desired steady state.
The checkout is being used as both source and installed product, and `main` is
being used as both upstream mirror and private carry branch.

## Desired Steady State

- `main` is a clean local mirror of `origin/main`.
- `eco/main` is the long-lived operator carry branch. It contains local changes,
  is periodically rebased onto `origin/main`, and may be force-pushed with
  `--force-with-lease`.
- `backup/eco-main/YYYYMMDD-before-rebase` branches preserve recoverable refs
  before every rebase or destructive cleanup.
- Short-lived feature branches start from `eco/main` and land back into
  `eco/main` by rebase, squash, or cherry-pick before the next upstream rebase.
- Upstream contribution PRs use separate stabilized branches, not the regularly
  rewritten carry branch.
- The installed runtime is a copied artifact under
  `~/.local/share/codegraph/runtimes/<channel>-<commit>/`.
- `~/.local/share/codegraph/current` points at the selected copied runtime.
- `~/.local/bin/codegraph` points at the copied runtime or a stable launcher,
  never at the development checkout.
- Codex MCP config continues to launch `codegraph serve --mcp`, relying on the
  stable PATH entry rather than a checkout-specific absolute path.

## Non-Goals

- Do not publish a release, create a tag, or run the GitHub Actions release
  workflow as part of this plan.
- Do not rewrite upstream history.
- Do not force-push `main`.
- Do not reset local `main` until the carry branch and repo-independent runtime
  have both been created and verified.
- Do not make `.codegraph/` or installed runtime directories tracked source.

## Branch Contract

| Ref | Owner | Rewrite policy | Purpose |
|---|---|---|---|
| `origin/main` | upstream | never local-write | canonical upstream source |
| `main` | local mirror | reset only to `origin/main` | clean upstream checkout point |
| `eco/main` | operator | rebase and `--force-with-lease` allowed | permanent local carry branch |
| `backup/eco-main/*` | operator | append-only unless intentionally pruned | recovery refs before rebases |
| `feature/*` or `fix/*` | operator | short-lived | bounded work before landing on `eco/main` |
| `pr/*` or descriptive branch | operator/upstream review | stabilize while reviewed | upstream contribution branches |

Periodic upstream refresh:

```bash
git fetch origin cochran --prune
git switch eco/main
git branch backup/eco-main/$(date +%Y%m%d)-before-rebase eco/main
git rebase origin/main
npm run build
npm test
git push --force-with-lease cochran eco/main
```

## Runtime Install Contract

The development repo is source. The installed runtime is product. Installing
from source must copy the runnable output and production dependencies into an
external runtime directory before the shell or MCP surfaces use it.

Target layout:

```text
~/.local/share/codegraph/
  current -> runtimes/eco-main-<commit>
  runtimes/
    eco-main-<commit>/
      dist/
      node_modules/
      package.json
      package-lock.json
~/.local/bin/codegraph -> ~/.local/share/codegraph/current/dist/bin/codegraph.js
```

Runtime install procedure:

```bash
npm run build
runtime="$HOME/.local/share/codegraph/runtimes/eco-main-$(git rev-parse --short=12 HEAD)"
mkdir -p "$runtime"
cp -R dist package.json package-lock.json "$runtime"/
(cd "$runtime" && npm ci --omit=dev --ignore-scripts)
ln -sfn "$runtime" "$HOME/.local/share/codegraph/current"
ln -sfn "$HOME/.local/share/codegraph/current/dist/bin/codegraph.js" "$HOME/.local/bin/codegraph"
codegraph --version
codegraph doctor /home/ecochran76/workspace.local/codegraph --target=codex --location=global --json --timeout=30000
```

## Critical Path

1. Create the long-lived `eco/main` branch at the current rebased commit.
2. Push `eco/main` to the `cochran` fork and set upstream tracking.
3. Build the current source tree.
4. Copy the built runtime and production dependencies into
   `~/.local/share/codegraph/runtimes/eco-main-<commit>/`.
5. Repoint `~/.local/share/codegraph/current` and `~/.local/bin/codegraph` to
   the copied runtime.
6. Smoke the installed command and Codex MCP path from the copied runtime.
7. Once the carry branch and installed runtime are proven, reset local `main` to
   mirror `origin/main`.

## Acceptance Criteria

- A durable plan exists under `docs/dev/plans/` documenting the branch and
  runtime model.
- `eco/main` exists locally at the current rebased commit.
- `cochran/eco/main` exists and tracks the local carry branch.
- The installed `codegraph` command no longer resolves into
  `/home/ecochran76/workspace.local/codegraph/dist/`.
- The copied runtime can execute `codegraph --version`.
- `codegraph doctor` passes for Codex global MCP using the copied runtime.
- A backup ref exists before any destructive reset of `main`.
- Local `main` is eventually restored to a clean mirror of `origin/main`.

## Execution Log

### Turn 1 | 2026-07-09

- Plan opened from the operator request to make the branch/runtime strategy
  durable and execute it.
- Current state confirmed: local `main` is at `21bcbed411b7d5ffc7cdcc8bcc05187d40a61a14`
  and reports `ahead 331, behind 6` relative to `cochran/main`.
- Current install confirmed: `/home/ecochran76/.local/bin/codegraph` points into
  the development checkout.
- Created `eco/main` as the long-lived operator carry branch.
- Pushed `eco/main` to the `cochran` fork and configured upstream tracking.
- Created `backup/main-before-mirror-reset-20260709` before changing local
  `main`.
- Reset the local `main` ref to `origin/main` and configured it to track
  `origin/main`.
- Created `backup/eco-main/20260709-before-rebase` before refreshing the carry
  branch.
- Rebasing `eco/main` after a fresh upstream fetch pulled in upstream
  `origin/main` at `e552dc2d2f5da4507ebe906b68b3ba806e204eb8` and version
  `1.3.1`.
- The branch and runtime model is now the documented steady state for this
  workstation.

## Definition Of Done

- The branch model is both documented and reflected in local/remote refs.
- The active installed runtime is independent of the development checkout.
- The final readback records exact refs, symlink targets, runtime path, version,
  and Codex MCP doctor result.
