# Git Topology Viewer

[日本語版](README.ja.md)

A VS Code extension for understanding relationships between branches and tags from a repository's **commit DAG**. It never infers that one branch was created from another.

## Features

- A vertical relation graph of local branches and optional tags or remote branches.
- Each ref group has one edge to its nearest older visible ref in the Git DAG.
- No commit nodes, commit counts, or commit-range expansion controls.
- Ref comparison with merge base, unique commits, line statistics, and changed files.
- Compare refs for merge bases, unique commits, line statistics, and changed files.
- Read-only branch file diffs opened in VS Code's standard diff editor—no checkout required.
- Git CLI discovery from VS Code's Git extension, `gitTopology.gitPath`, then `PATH`.

## Open the viewer

Open a folder containing a Git repository, select the **Git Topology** graph icon in
the Activity Bar on the left, and choose **Open Git Topology Viewer**. You can also
run **Git Topology: Open Viewer** from the Command Palette.

## Run locally

```powershell
npm install
npm run build
```

Open this folder in VS Code, press **F5**, open a Git repository in the Extension
Development Host, then use the **Git Topology** icon in the Activity Bar.

### Webview smoke test

Install the pinned Chromium browser once, then render the production webview bundle,
exercise ref comparison, and save a screenshot:

```powershell
npm run smoke:install
npm run smoke:webview
```

The screenshot is written to `artifacts/webview-smoke.png`. The complete environment,
automated assertions, manual review checklist, and troubleshooting notes live in
`.agents/skills/git-topology-webview-smoke-test/`.

## Design

The extension loads SHA/parent/ref summaries first through `git for-each-ref` and `git rev-list`. The immutable DAG is projected into visible ref groups, with edges only where no other visible ref lies between them. Comparisons and file bodies are loaded only on demand through Git CLI commands.
