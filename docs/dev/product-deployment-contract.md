# Product Deployment Contract

This contract defines what a CodeGraph release must ship and what remains
operator-local. It is the durable scope reference for Plan 0002.

## Release Artifacts

Authoritative release artifacts:

- GitHub Release tag `vX.Y.Z`.
- Platform archives:
  - `codegraph-darwin-arm64.tar.gz`
  - `codegraph-darwin-x64.tar.gz`
  - `codegraph-linux-arm64.tar.gz`
  - `codegraph-linux-x64.tar.gz`
  - `codegraph-win32-arm64.zip`
  - `codegraph-win32-x64.zip`
- `SHA256SUMS` for the platform archives.
- npm generated packages under `@colbymchenry`:
  - `codegraph` main shim package.
  - one `codegraph-<platform>-<arch>` optional package per supported platform.

The repository root package is not the publish artifact. Release publishing must
use the generated package layout from `scripts/pack-npm.sh`.

## Product Payload

Every executable artifact must carry:

- `dist/bin/codegraph.js`.
- `dist/index.js` and library entrypoint types.
- `dist/db/schema.sql`.
- `dist/extraction/wasm/*.wasm`.
- `dist/skills/codegraph-workspace/SKILL.md`.
- `dist/skills/codegraph-workspace/agents/openai.yaml`.
- Production runtime dependencies.

Standalone bundles additionally carry the vendored Node runtime and launcher
scripts under `bin/`.

## Installed Agent Surfaces

`codegraph install` owns these surfaces:

| Target | Global MCP config | Local MCP config | Instructions | Skill |
|---|---|---|---|---|
| Claude Code | `~/.claude.json` | `./.mcp.json` | `CLAUDE.md` | global `~/.agents/skills/codegraph-workspace` |
| Cursor | `~/.cursor/mcp.json` | `./.cursor/mcp.json` | local `.cursor/rules/codegraph.mdc` | global `~/.agents/skills/codegraph-workspace` |
| Codex CLI | `~/.codex/config.toml` | not supported | `~/.codex/AGENTS.md` | global `~/.agents/skills/codegraph-workspace` |
| opencode | `~/.config/opencode/opencode.jsonc` | `./opencode.jsonc` | `AGENTS.md` | global `~/.agents/skills/codegraph-workspace` |
| Hermes Agent | `~/.hermes/config.yaml` | not supported | none | global `~/.agents/skills/codegraph-workspace` |

Skill installation is a shared global agent surface, not a per-target config
block. It is installed during global installs and removed during global
uninstalls. Local installs do not write user-level skills.

Installer rules:

- Preserve sibling agent configs and sibling user skills.
- Own only the marker-delimited CodeGraph instruction block, CodeGraph MCP
  entry, CodeGraph permissions/toolset entries, and the
  `codegraph-workspace` skill directory.
- Reinstall must be idempotent when on-disk content already matches the product
  payload.
- Uninstall must leave `.codegraph/` indexes untouched.

## Local State

The following are not release artifacts and must stay out of tracked product
payloads:

- `.codegraph/` SQLite indexes.
- tenant, customer, or workstation runtime data.
- user-modified agent config outside CodeGraph-owned blocks.
- user-level skill copies except those created by the installer.

## Verification Gates

Release-candidate verification must prove:

- `npm run build` copies the skill into `dist/skills/codegraph-workspace/`.
- `npm run check:product-artifacts` validates built schema, WASM grammars, and
  skill payload before tests run.
- `npm run check:release-artifacts` validates generated platform archives and
  generated platform npm packages before publish.
- generated bundles and platform npm packages include that skill payload.
- install/reinstall/uninstall preserve sibling state and manage the skill
  directory correctly.
- `codegraph doctor --json` can launch MCP and answer `codegraph_status`
  against an indexed repo from the installed runtime.
- Windows installer claims are backed by a real Windows PowerShell smoke or are
  marked as blocked for that release.
