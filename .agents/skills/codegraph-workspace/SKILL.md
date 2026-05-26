---
name: codegraph-workspace
description: Use when working inside a repository that has CodeGraph installed or a .codegraph index, when the user asks to use CodeGraph, or when investigating, reviewing, refactoring, or planning code changes with codegraph_* MCP tools or the codegraph CLI available. Guides agents to check and sync the index, prefer structural graph queries over grep/read, and report stale or skipped-file caveats.
---

# CodeGraph Workspace

Use CodeGraph as the first pass for structural code understanding. It is for
symbols, call paths, imports, impact, and file structure. It is not a source of
product requirements, runtime truth, test results, or user intent.

## Startup

1. Identify the repo root for the task.
2. Check index health before structural investigation:
   - MCP available: call `codegraph_status`.
   - CLI fallback: run `codegraph status -p <repo>` or `codegraph status <repo>`.
3. If the repo is not initialized, do not silently create an index unless the
   user asked to install/index/use CodeGraph. Otherwise ask before running
   `codegraph init -i <repo>`.
4. If status shows pending changes and the task depends on current code, run
   `codegraph sync <repo>` before querying. If sync leaves pending files, report
   them in the answer.
5. Treat `.codegraph/` as local derived state. Keep it out of tracked source.

## Tool Selection

- Where is symbol X defined? Use `codegraph_search`.
- What is this feature or area? Use `codegraph_context`, then one targeted
  `codegraph_explore` if source is needed.
- How does X reach Y? Use `codegraph_trace` first, then `codegraph_explore` for
  hop bodies if needed.
- What calls X? Use `codegraph_callers`.
- What does X call? Use `codegraph_callees`.
- What would changing X affect? Use `codegraph_impact`.
- Show one symbol's details or body? Use `codegraph_node`.
- Survey several related symbols or files at once? Use `codegraph_explore`.
- What files exist under a path? Use `codegraph_files`.

If MCP tools are unavailable, use the CLI equivalents where available:
`codegraph query`, `codegraph context`, `codegraph callers`,
`codegraph callees`, `codegraph impact`, `codegraph affected`, and
`codegraph files`.

## Workflow Patterns

- Onboarding or architecture question: `codegraph_context` -> targeted
  `codegraph_explore` -> answer.
- Flow question: `codegraph_trace` from/to -> targeted `codegraph_explore` if
  the inlined path is not enough -> answer.
- Refactor planning: `codegraph_search` -> `codegraph_callers` ->
  `codegraph_impact` -> plan edits and tests.
- Review or regression triage: start at the changed or suspected symbol, inspect
  callers/callees, then widen with impact.
- Test selection after edits: use `codegraph affected` when the CLI is
  available, then add project-specific tests from repo guidance.

## Guardrails

- Do not grep or read files just to re-verify a CodeGraph structural answer.
  Use grep/read for literal strings, unsupported files, generated assets,
  precise line ranges not returned by CodeGraph, or runtime evidence.
- Do not loop over many `codegraph_node` calls when one `codegraph_explore` can
  return the relevant source grouped by file.
- After editing files, wait for the watcher debounce or run `codegraph sync`
  before querying the changed area again.
- When CodeGraph is stale, uninitialized, missing MCP tools, or skipping large
  files, say that directly and adjust confidence.
- Keep final answers grounded: cite files/symbols returned by CodeGraph and
  mention any fallback grep/read or tests that were needed.
