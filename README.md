# Git Topology Viewer

A VS Code extension for reading a repository's **commit DAG** at the level you need. Branches and tags remain labels on commits; the viewer never invents a branch-parent tree.

## Features

- **Topology**, **Compact**, and **Full** vertical graph modes.
- Collapsed linear commit ranges that expand independently.
- Local branches and tags, with optional remote branches and a branch filter.
- Ref comparison with merge base, unique commits, line statistics, and changed files.
- Read-only branch file contents opened in VS Code's standard diff editor—no checkout required.
- Git CLI discovery from VS Code's Git extension, `gitTopology.gitPath`, then `PATH`.

## Run locally

```sh
npm install
npm run build
```

Open this folder in VS Code, press **F5**, open a Git repository in the Extension Development Host, then run **Git Topology: Open Viewer** from the Command Palette.

### Webview smoke test

Install the pinned Chromium browser once, then render the production webview bundle,
exercise ref comparison, and save a screenshot:

```sh
npm run smoke:install
npm run smoke:webview
```

The screenshot is written to `artifacts/webview-smoke.png`. The complete environment,
automated assertions, manual review checklist, and troubleshooting notes live in
`.agents/skills/git-topology-webview-smoke-test/`.

## Sample

![Git Topology Viewer sample](docs/images/webview-smoke.png)

## Design

The extension loads SHA/parent/ref summaries first through `git for-each-ref` and `git rev-list`. The immutable DAG is converted into a mode-specific view graph and then laid out. Comparisons and file bodies are loaded only on demand through Git CLI commands.
