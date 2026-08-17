---
name: git-topology-webview-smoke-test
description: Run, inspect, maintain, and troubleshoot the Git Topology Viewer browser smoke test and screenshot harness. Use after perceptible React/SVG webview changes, message-contract changes, compare-panel changes, CSS/build changes, or when validating the bundled webview without launching a VS Code Extension Development Host.
---

# Git Topology webview smoke test

Render the production `dist/webview.js` and `dist/webview.css` in headless Chromium
against a deterministic VS Code API/message fixture. Exercise the primary selection
and comparison flow and retain a screenshot for human inspection.

## Prepare the environment

1. Run `npm install`.
2. Run `npm run smoke:install` once per machine or after changing the pinned
   Playwright version. If Linux shared libraries are missing, run
   `npx playwright install-deps chromium`, then retry.
3. Read [smoke-test-guide.md](references/smoke-test-guide.md) for the environment,
   coverage boundaries, visual review checklist, and troubleshooting procedure.

Keep `@playwright/test` pinned exactly. Browser binaries are cached outside the
repository, while generated screenshots belong in ignored `artifacts/`.

## Run and inspect

1. Run `npm run smoke:webview` from the repository root.
2. Confirm that the process reports `Webview smoke test passed`.
3. Open `artifacts/webview-smoke.png` with an image viewer. Do not treat script
   success as visual approval.
4. Inspect graph direction, lane edges, ref labels, toolbar state,
   inspector layout, comparison metrics, changed-file statuses, clipping, contrast,
   and unexpected blank space.
5. Report the exact command and screenshot path. Attach or publish the screenshot
   through the surrounding agent/CI environment when requested; do not commit it.

Set `SMOKE_SCREENSHOT=/absolute/path.png` to choose another output path.

## Maintain the fixture

- Keep `test/smoke/fixture.js` deterministic and representative: ref groups,
  divergence, merge-shaped relations, branch and tag refs, and a comparison
  containing modified/added/deleted files; include scoped branch history and
  commit-detail responses when those panes are present.
- Update fixture messages whenever the serialized extension/webview contract changes.
- Add assertions for new critical interactions rather than relying only on pixels.
- Exercise the bundled assets through the local HTTP server; do not import source
  components directly, because the build and stylesheet link are part of the test.
- Keep timeouts short enough to turn a missing fixture event into an actionable
  failure. Capture browser `pageerror` events.

This harness does not validate VS Code API registration, real Git execution,
virtual document behavior, CSP enforcement inside VS Code, or platform-specific
fonts. Use an Extension Development Host for those integration concerns.
