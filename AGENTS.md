# Git Topology Viewer agent guide

## Mission and invariants

Build a VS Code extension for understanding Git history structure, not another Git
operation UI. Preserve these invariants in every change:

1. The commit DAG returned by Git is the source of truth. Never persist or invent a
   parent/child hierarchy between branches.
2. Branches and tags are `GitRef` labels attached to commits, not graph nodes.
3. Topology, Compact, and Full are projections of the same DAG. Mode changes must
   not mutate the underlying `CommitGraph`.
4. Delegate repository semantics to the Git CLI rather than reimplementing them.
5. Keep the domain layer independent of `vscode`, React, and webview APIs.
6. Treat repository access as read-only unless a task explicitly requests a write
   operation. Opening a diff must never require checkout.

Read `.agents/skills/git-topology-development/SKILL.md` before changing Git,
topology, layout, VS Code integration, or webview code.

## Repository map

- `src/git/`: process execution and parsing of Git CLI output.
- `src/domain/`: API-independent models and DAG-to-view transformations.
- `src/vscode/`: panels, virtual documents, commands, and message mediation.
- `src/webview/`: React/SVG presentation. It must not execute Git.
- `test/`: Vitest tests, with emphasis on graph shape and edge cases.
- `dist/`: generated and ignored; never edit or commit it.

Dependencies must flow `webview/vscode -> domain` and `vscode -> git/domain`, never
from `domain` to an integration layer. Keep extension/webview messages serializable.

## Working procedure

1. Inspect `git status` and the relevant models before editing.
2. Put Git command construction/parsing in `src/git`; put pure transformations in
   `src/domain`; keep presentation decisions in `src/webview`.
3. Add or update tests for graph compression, merges, branch points, lane behavior,
   parsing, or message contracts affected by the change.
4. Run `pwsh -NoProfile -File .agents/skills/git-topology-development/scripts/validate.ps1` before commit.
5. For a perceptible webview change, build and inspect it in VS Code or a browser
   harness and capture a screenshot. Follow
   `.agents/skills/git-topology-webview-smoke-test/SKILL.md` and run
   `npm run smoke:webview` for the maintained browser harness.
6. Commit source changes on the current branch. Do not commit `dist/`, temporary
   repositories, screenshots, or editor state unless explicitly requested.

## Coding conventions

- Use strict TypeScript and explicit domain types at integration boundaries.
- Prefer small, named functions over dense multi-statement lines.
- Parse machine-readable Git output with NUL delimiters where paths are involved.
- Pass Git arguments as an array; never interpolate untrusted refs or paths into a
  shell command.
- Use `--` before path arguments when supported and preserve rename/delete cases.
- Add React `key` props to rendered collections and accessible labels/titles to
  icon-only controls.
- Never put `try`/`catch` around imports.
- Surface actionable Git failures to the user without leaking raw command details
  unless they help diagnose the problem.

## Localization

- English is the default UI language and Japanese (`ja`) is supported. When adding
  or changing user-visible text, update both languages in the same change.
- Put extension manifest strings in `package.nls.json` and
  `package.nls.ja.json`. Put extension-host strings in `l10n/bundle.l10n.json`
  and `l10n/bundle.l10n.ja.json`, accessed through `vscode.l10n.t()`.
- Put Webview text in `src/webview/i18n.ts`; select it from the document language.
  Do not introduce hard-coded user-visible text in React components.
- Preserve interpolation placeholders and accessibile labels in every locale. Add
  or update a localization-focused test and inspect the Japanese Webview smoke
  screenshot whenever visible Webview text changes.

## Required checks

Run `pwsh -NoProfile -File .agents/skills/git-topology-development/scripts/validate.ps1`. If a command
cannot run because of the environment, report it as a warning rather than silently
skipping it. A passing build alone is not a substitute for tests.
