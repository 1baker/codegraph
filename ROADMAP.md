# ROADMAP.md

## P02 | Product Deployment

State: CLOSED

Current State: Product deployment readiness is closed as release-ready. The
product contract exists, `codegraph-workspace` builds into release artifacts,
global install/uninstall manages the shared user-level skill, `codegraph doctor`
verifies installed runtime/MCP/skill/index health, generated bundle/npm package
payload checks pass, Linux and Windows generated-artifact smokes pass, the
workstation Codex install points to the generated Linux x64 artifact, fresh
Codex prompt-input sees the installed skill, and active indexed repos are
current. The production dependency audit is clean after the `picomatch`
runtime dependency update. Oversized source files are tracked as skipped
instead of permanent pending changes.

Priority:

- Keep release publishing on the GitHub Actions Release workflow.
- Preserve generated-artifact checks and `codegraph doctor` as release gates.
- Do not publish manually from the repository root package.
- Track dev-only audit findings separately from the production release gate.

Active Plan:

- `docs/dev/plans/0002-2026-05-26-product-deployment-plan.md`

## P01 | Codex Install Readiness

State: CLOSED

Current State: Repo-local policies are installed and the install-readiness work is closed in `docs/dev/plans/0001-2026-05-25-codex-install-readiness.md`. Codex global MCP config is installed, the Codex-first installer/runtime/package/docs fixes are validated locally, and the curated sibling batch is indexed.

Priority:

- Keep runtime/package metadata and release-artifact safety aligned with the generated-release flow.
- Expand indexing only for repos with active structural-retrieval need.
- Validate PowerShell standalone installer behavior before claiming Windows coverage.

Active Plan:

- `docs/dev/plans/0001-2026-05-25-codex-install-readiness.md`
