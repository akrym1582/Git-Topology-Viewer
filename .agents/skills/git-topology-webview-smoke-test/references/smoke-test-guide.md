# Webview smoke-test guide

## Environment

The smoke test uses:

- the repository's supported Node.js/npm toolchain;
- the exactly pinned `@playwright/test` package;
- Playwright's headless Chromium binary and Linux runtime libraries;
- a temporary loopback HTTP server created by the Node test process;
- production bundles emitted by `npm run build`;
- `test/smoke/fixture.html` and `fixture.js` as the VS Code API and message fixture.

Install dependencies with:

```sh
npm install
npm run smoke:install
```

On a minimal Linux container, install browser system libraries if required:

```sh
npx playwright install-deps chromium
```

Browser downloads and OS packages are machine setup, not repository artifacts.

## Execution path

`npm run smoke:webview` performs the following sequence:

1. Build the extension and webview production bundles.
2. Start an HTTP server on an ephemeral `127.0.0.1` port.
3. Load the fixture and production JS/CSS in a 1440 x 900 headless Chromium page.
4. Inject a mock `acquireVsCodeApi()` that records outbound messages.
5. Send a representative graph response to React.
6. Assert commit nodes and collapsed ranges are rendered.
7. Select `main`, choose `develop`, and click **Compare refs**.
8. Assert the outbound `compareRefs` request.
9. Send a comparison response and assert statistics and changed files render.
10. Fail on uncaught page errors and write `artifacts/webview-smoke.png`.
11. Close Chromium and the HTTP server even when an assertion fails.

## Automated checks

- Production bundle and stylesheet can be loaded over HTTP.
- The loading screen transitions to the graph.
- Expected commit and collapsed-range counts render.
- Clicking a ref opens its inspector.
- Selecting a comparison target sends the expected message contract.
- Comparison metrics and file rows render from an extension response.
- No uncaught browser page error occurs.

## Human visual review

Inspect the screenshot for:

- latest-to-oldest vertical flow and horizontal lane separation;
- continuous, correctly connected SVG paths at divergence and convergence;
- readable branch/tag labels without overlap or clipping;
- collapsed ranges placed on the intended lane and visually clickable;
- active mode, filter controls, repository identity, and node/ref totals;
- selected-ref inspector hierarchy and aligned controls;
- merge base, ahead/behind, file count, additions/deletions, and M/A/D colors;
- VS Code-like dark-theme contrast at 1440 x 900;
- missing CSS, fallback browser styling, blank panels, horizontal overflow, or
  excessive layout shift.

## Troubleshooting

### Browser executable is missing

Run `npm run smoke:install`. Confirm that the Playwright package version in
`package.json` matches the installed browser cache. Do not change to a caret range.

### Linux library validation fails

Run `npx playwright install-deps chromium`. In restricted environments, report the
smoke test as an environment warning and retain the build/unit-test results.

### The test waits on the loading screen

Check that `fixture.js` is served successfully and dispatches the graph message
after React registers its `message` event listener. Keep the short delay in the
fixture unless the application adds an explicit ready handshake.

### CSS is missing

Confirm `dist/webview.css` exists after build and that `fixture.html` links the
production stylesheet. A browser-default-looking screenshot is a failed smoke test.

### Update expected behavior

Change fixture data and semantic assertions together. Re-run the test and visually
inspect the new screenshot. Do not update assertions merely to silence a regression.
