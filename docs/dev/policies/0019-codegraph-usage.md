# Policy | Codegraph Usage

## Policy

- Use the available CodeGraph index before non-trivial source-code edits,
  architecture claims, trace analysis, refactor plans, or impact analysis.
- Prefer structural CodeGraph lookups for questions such as:
  - where a symbol is defined
  - what calls or depends on a function, class, route, component, or module
  - how one behavior flows into another
  - what a refactor is likely to affect
  - which files make up an unfamiliar subsystem
- Prefer CodeGraph tools or CLI commands over broad manual grep loops for
  symbol, flow, caller/callee, and architecture questions. Use text search and
  direct file reads for literal strings, comments, log text, exact docs prose,
  or details the index does not cover.
- Treat CodeGraph as a discovery and impact-analysis aid, not as proof that a
  change is correct. Validate behavior with source reads, targeted tests,
  type checks, release-artifact checks, MCP smokes, browser checks, or runtime
  smokes as appropriate for the touched surface.
- Account for index freshness. After editing code, wait for the watcher to
  refresh or use direct source reads and validation instead of assuming the
  graph reflects the newest file state.
- Keep secrets, credentials, private logs, and unrelated runtime data out of
  indexed CodeGraph inputs or persisted analysis artifacts.
- If CodeGraph tooling is unavailable, stale, or not indexed for the target
  repo, proceed with ordinary repo inspection and state the fallback in the
  handoff when it affects confidence.

## Repo Notes

- This repo is both the CodeGraph product and an indexed CodeGraph target.
  Using CodeGraph here is encouraged, but product behavior still needs
  independent validation from tests, release-artifact checks, and installed
  runtime smokes.
- Prefer the repo-documented commands and MCP tools for this checkout:
  `codegraph status`, `codegraph query`, `codegraph context`, `codegraph files`,
  `codegraph affected`, and the corresponding MCP tool surface.
- Keep `.codegraph/` workstation-local. It is derived index state, not tracked
  source.

## Adoption Notes

Use this module when working in this repo or in any sibling checkout where a
fresh CodeGraph index is available or expected.
