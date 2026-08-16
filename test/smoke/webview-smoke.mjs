import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const screenshot = resolve(process.env.SMOKE_SCREENSHOT ?? join(root, 'artifacts/webview-smoke.png'));
const imageDir = resolve(root, 'docs/images');
const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.map': 'application/json' };

function startServer() {
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
      const relative = pathname === '/' ? 'test/smoke/fixture.html' : pathname.slice(1);
      const file = normalize(join(root, relative));
      if (!file.startsWith(`${root}${sep}`)) throw new Error('Path escapes fixture root');
      response.setHeader('content-type', types[extname(file)] ?? 'application/octet-stream');
      response.end(await readFile(file));
    } catch {
      response.statusCode = 404;
      response.end('Not found');
    }
  });
  return new Promise(resolveServer => server.listen(0, '127.0.0.1', () => resolveServer(server)));
}

const server = await startServer();
const address = server.address();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(5_000);
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));

try {
  await page.goto(`http://127.0.0.1:${address.port}/test/smoke/fixture.html`, { waitUntil: 'networkidle' });
  await page.getByText('commerce-platform').waitFor();
  await mkdir(imageDir, { recursive: true });
  await page.screenshot({ path: join(imageDir, 'smoke-main-screen.png'), fullPage: true });

  // Rendering: toolbar, refs, collapsed ranges, and vertical/horizontal SVG edges.
  if (await page.locator('.node').count() !== 6) throw new Error('Expected six commit nodes');
  if (await page.locator('.range').count() !== 2) throw new Error('Expected two collapsed ranges');
  await page.getByRole('button', { name: 'Expand 12 commits' }).click();
  let request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  if (request?.type !== 'expandRange' || request.rangeId !== 'range:main') {
    throw new Error(`Unexpected expand range request: ${JSON.stringify(request)}`);
  }
  await page.getByRole('button', { name: 'Collapse 12 commits' }).click();
  request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  if (request?.type !== 'expandRange' || request.rangeId !== 'range:main') {
    throw new Error(`Unexpected collapse range request: ${JSON.stringify(request)}`);
  }
  await page.getByRole('button', { name: 'Expand 12 commits' }).waitFor();
  await page.getByText('Remote branches').click();
  await page.locator('.ref.remoteBranch').first().waitFor();
  const remoteLabels = await page.locator('.ref.remoteBranch').evaluateAll(elements => elements.map(element => {
    const transform = element.getAttribute('transform') ?? '';
    return transform.match(/translate\(([^,]+),([^\)]+)\)/)?.slice(1) ?? [];
  }));
  if (remoteLabels.length !== 2 || remoteLabels[0][0] !== remoteLabels[1][0] || remoteLabels[0][1] === remoteLabels[1][1]) {
    throw new Error(`Expected two remote refs stacked vertically: ${JSON.stringify(remoteLabels)}`);
  }
  const invalidRefConnectors = await page.evaluate(() => [...document.querySelectorAll('.node')].flatMap(node => {
    const refs = [...node.querySelectorAll('.ref')];
    const connectors = [...node.querySelectorAll('.ref-connectors path')];
    if (refs.length !== connectors.length) return [{ commit: node.getAttribute('data-commit'), reason: 'count' }];
    return refs.flatMap((ref, index) => {
      const refPosition = (ref.getAttribute('transform') ?? '').match(/translate\(([^,]+),([^\)]+)\)/)?.slice(1).map(Number);
      const connectorPosition = (connectors[index].getAttribute('d') ?? '').match(/M 0 0 L ([^ ]+) ([^ ]+)/)?.slice(1).map(Number);
      return !refPosition || !connectorPosition || connectorPosition[0] !== refPosition[0] || connectorPosition[1] !== refPosition[1] + 14
        ? [{ commit: node.getAttribute('data-commit'), ref: ref.getAttribute('aria-label') }]
        : [];
    });
  }));
  if (invalidRefConnectors.length) throw new Error(`Expected each ref label to connect directly to its commit: ${JSON.stringify(invalidRefConnectors)}`);
  const refsBelowCommitIds = await page.evaluate(() => [...document.querySelectorAll('.node')].flatMap(node => {
    const sha = node.querySelector('.sha')?.getBoundingClientRect();
    if (!sha) return [];
    return [...node.querySelectorAll('.ref')]
      .map(ref => ref.getBoundingClientRect())
      .filter(ref => ref.bottom > sha.top)
      .map(() => node.getAttribute('data-commit'));
  }));
  if (refsBelowCommitIds.length) throw new Error(`Expected refs above commit IDs: ${JSON.stringify(refsBelowCommitIds)}`);
  const overlaps = await page.evaluate(() => {
    const refs = [...document.querySelectorAll('.ref')].map(element => element.getBoundingClientRect());
    const ranges = [...document.querySelectorAll('.range')].map(element => element.getBoundingClientRect());
    return ranges.flatMap((range, rangeIndex) => refs.flatMap((ref, refIndex) =>
      range.left < ref.right && range.right > ref.left && range.top < ref.bottom && range.bottom > ref.top
        ? [{ rangeIndex, refIndex }] : []));
  });
  if (overlaps.length) throw new Error(`Range labels overlap ref labels: ${JSON.stringify(overlaps)}`);
  const zoomPosition = await page.locator('.zoom-controls').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, bottom: window.innerHeight - rect.bottom, height: rect.height };
  });
  if (zoomPosition.left !== 12 || zoomPosition.bottom !== 12 || zoomPosition.height !== 28) {
    throw new Error(`Expected zoom controls at the lower left: ${JSON.stringify(zoomPosition)}`);
  }
  const initialWidth = Number(await page.locator('.canvas svg').getAttribute('width'));
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Reset zoom' }).getByText('110%').waitFor();
  const zoomedWidth = Number(await page.locator('.canvas svg').getAttribute('width'));
  if (zoomedWidth <= initialWidth) throw new Error('Zoom in did not increase the graph canvas width');
  await page.getByRole('button', { name: 'Reset zoom' }).click();
  await page.getByRole('button', { name: 'Reset zoom' }).getByText('100%').waitFor();
  await page.screenshot({ path: join(imageDir, 'smoke-local-and-remote-branches.png'), fullPage: true });

  // Right-click requests host-curated exploration actions.
  await page.locator('.ref.localBranch').first().click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Show Merge Base' }).waitFor();
  await page.screenshot({ path: join(imageDir, 'smoke-context-menu.png'), fullPage: true });
  if (!await page.getByRole('menuitem', { name: 'Checkout', exact: true }).isDisabled()) {
    throw new Error('The current branch checkout action should be disabled');
  }
  await page.getByRole('menuitem', { name: 'Select as Compare Base' }).click();
  request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  if (request?.type !== 'runContextCommand' || request.command !== 'selectCompareBase') {
    throw new Error(`Unexpected context command: ${JSON.stringify(request)}`);
  }

  // Ctrl-clicking a second ref immediately requests a comparison for the pair.
  await page.locator('.ref.localBranch').nth(1).click({ modifiers: ['Control'] });
  request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  if (request?.type !== 'compareRefs' || request.left !== 'refs/heads/main' || request.right !== 'refs/heads/feature/login') {
    throw new Error(`Unexpected Ctrl-click comparison: ${JSON.stringify(request)}`);
  }

  // Mutating operations remain explicit extension-host intents.
  await page.locator('.ref.localBranch').nth(1).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Checkout', exact: true }).click();
  request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  if (request?.type !== 'runContextCommand' || request.command !== 'checkout') {
    throw new Error(`Unexpected checkout request: ${JSON.stringify(request)}`);
  }

  await page.locator('.ref.localBranch').first().click();
  await page.getByRole('heading', { name: 'main' }).waitFor();
  // Interaction contract: compare intent is sent to VS Code, then its response renders.
  await page.locator('select').selectOption('refs/heads/develop');
  await page.getByRole('button', { name: 'Compare refs' }).click();
  request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  if (request?.type !== 'compareRefs' || request.right !== 'refs/heads/develop') {
    throw new Error(`Unexpected compare request: ${JSON.stringify(request)}`);
  }
  await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: window.__smokeComparison })));
  await page.getByText('532', { exact: false }).waitFor();
  await page.getByText('src/AuthService.ts').waitFor();

  await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: window.__smokeRefLog })));
  await page.getByRole('heading', { name: 'Branch log' }).waitFor();
  await page.screenshot({ path: join(imageDir, 'smoke-branch-log.png'), fullPage: true });

  // Keep the expanded branch actions visible in the captured visual artifact.
  await page.locator('.ref.localBranch').nth(1).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Show Merge Base' }).waitFor();
  await page.screenshot({ path: join(imageDir, 'smoke-branch-comparison-context-menu.png'), fullPage: true });

  await mkdir(resolve(screenshot, '..'), { recursive: true });
  await page.screenshot({ path: screenshot, fullPage: true });
  if (pageErrors.length) throw new Error(`Webview errors: ${pageErrors.join('; ')}`);
  console.log(`Webview smoke test passed. Screenshot: ${screenshot}`);
} finally {
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
