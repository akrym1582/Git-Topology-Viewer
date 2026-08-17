---
name: git-topology-development
description: Develop, debug, review, and test the Git Topology Viewer VS Code extension. Use for changes to Git CLI discovery or parsing, commit DAG modeling, significant-node extraction, graph compression or lane layout, extension/webview messaging, React/SVG topology UI, branch comparisons, or virtual-document diff integration in this repository.
---

# Git Topology development

Preserve the immutable commit-DAG architecture while implementing changes across
the Git, domain, VS Code, and webview layers.

## Start work

1. Read the root `AGENTS.md` and inspect `git status`.
2. Read [architecture.md](references/architecture.md) when a change crosses layers,
   affects graph semantics, or invokes Git.
3. Identify the owning layer before editing:
   - Git invocation and output parsing: `src/git/`
   - Pure DAG/view/layout behavior: `src/domain/`
   - VS Code APIs and message routing: `src/vscode/` or `src/extension.ts`
   - React/SVG behavior only: `src/webview/`
4. Make the narrowest change that preserves public model and message contracts.

## Implement Git behavior

- Ask Git for repository facts; do not recreate revision semantics.
- Invoke Git through `GitClient.run()` with argument arrays.
- Prefer NUL-delimited output for file paths and refs when the Git command supports
  it. Cover spaces, tabs, Unicode, renames, deletion, empty output, and failure.
- Load only SHA, parents, and refs for the initial graph. Fetch messages, file lists,
  and bodies only for the interaction that needs them.
- Keep Git object reads read-only and avoid checkout for comparison.

## Implement relation behavior

- Treat `CommitGraph` as immutable input and create a `RefViewGraph` projection.
- Group visible refs by target commit, and connect each group to the nearest older
  visible groups reachable through the DAG. Do not infer which branch was created
  from another.
- Never render, count, or expand intermediate commits in the relation view.
- Test linear histories, roots, two-parent and octopus merges, truncated parents,
  visibility settings, and refs sharing a commit as applicable.
- Keep lane assignment deterministic for identical DAG/ref input.

## Implement integration and UI behavior

- Keep all Git access in the extension host. Send serializable data and commands
  through the webview message boundary.
- Generate webview resource URIs with `asWebviewUri` and retain a restrictive CSP.
- Open file comparisons through `TextDocumentContentProvider` and `vscode.diff`.
- Add stable React keys, usable keyboard controls, and VS Code-theme-compatible
  colors. Keep history vertical and lanes horizontal.
- For a visible change, run the build and inspect a realistic graph in the rendered
  webview; use the sibling `git-topology-webview-smoke-test` skill to exercise the
  production bundle and capture a screenshot.

## Validate and finish

Run `pwsh -NoProfile -File .agents/skills/git-topology-development/scripts/validate.ps1`. Add focused tests
beyond the standard script when changing parsers or graph semantics. Review
`git diff --check` and `git status`, then commit on the current branch. Summarize
behavior and list each exact check in the final response.
