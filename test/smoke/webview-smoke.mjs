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
  if (await page.getByText('Local branches', { exact: true }).count()) throw new Error('Local branches should always be visible, without a filter control');
  await page.getByRole('button', { name: 'Hide details' }).click();
  if (await page.locator('aside').count()) throw new Error('Expected the details pane to be hidden');
  await page.screenshot({ path: join(imageDir, 'smoke-inspector-hidden.png'), fullPage: true });
  await page.getByRole('button', { name: 'Show details' }).click();
  await page.locator('aside').waitFor();

  // Rendering: toolbar, refs, collapsed ranges, and vertical/horizontal SVG edges.
  if (await page.locator('.node').count() !== 6) throw new Error('Expected six commit nodes');
  if (await page.locator('.range').count() !== 2) throw new Error('Expected two collapsed ranges');
  if (await page.locator('.sha, .ref-sha').count() !== 0) throw new Error('Commit IDs should be hidden by default');
  await page.getByText('Commit IDs', { exact: true }).click();
  if (await page.locator('.ref-sha').count() !== 4) throw new Error('Expected a latest commit ID below every visible ref');
  if (await page.locator('.sha').count() !== 0) throw new Error('Collapsed commits should not expose commit IDs');
  await page.getByRole('button', { name: 'Expand 12 commits' }).click();
  await page.locator('[data-commit="e93b2101234567890"] .sha').waitFor();
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
  const refAlignment = await page.locator('.ref.localBranch').first().evaluate(element => {
    const refX = Number((element.getAttribute('transform') ?? '').match(/translate\(([^,]+)/)?.[1]);
    const iconX = Number(element.querySelector('.ref-icon')?.getAttribute('x'));
    return refX + iconX;
  });
  if (refAlignment !== 0) throw new Error(`Expected the graph line to cross the ref icon center, got ${refAlignment}`);
  const releaseRef = page.getByRole('button', { name: 'origin/release branch' });
  if (!(await releaseRef.textContent())?.includes('origin/release')) throw new Error('Expected the origin/release label not to be truncated');
  const releaseConnector = await page.locator('[data-ref-connector="refs/remotes/origin/release"]').evaluate(element => {
    const ref = document.querySelector('[aria-label="origin/release branch"]');
    const position = (ref?.getAttribute('transform') ?? '').match(/translate\(([^,]+),([^\)]+)\)/)?.slice(1).map(Number);
    const iconY = Number(ref?.querySelector('.ref-icon')?.getAttribute('y'));
    return { d: element.getAttribute('d'), expected: position ? `H ${position[0] + 14} V ${position[1] + iconY - 5}` : '' };
  });
  if (!releaseConnector.d?.includes(releaseConnector.expected)) throw new Error(`Expected origin/release to connect to its graph line: ${releaseConnector.d}`);
  const invalidRefNodes = await page.evaluate(() => [...document.querySelectorAll('.node')].flatMap(node => {
    const refs = [...node.querySelectorAll('.ref')];
    const circles = node.querySelectorAll('circle');
    if ((refs.length > 0 && circles.length > 0) || (refs.length === 0 && circles.length !== 1)) {
      return [{ commit: node.getAttribute('data-commit'), reason: 'node-shape' }];
    }
    const labels = [];
    for (const ref of refs) {
      const position = (ref.getAttribute('transform') ?? '').match(/translate\(([^,]+),([^\)]+)\)/)?.slice(1).map(Number);
      const type = [...ref.classList].find(value => ['tag', 'localBranch', 'remoteBranch'].includes(value));
      if (!position || !type) return [{ commit: node.getAttribute('data-commit'), reason: 'position' }];
      labels.push({ position, type });
    }
    if (labels.some(label => label.position[0] !== labels[0]?.position[0]) || new Set(labels.map(label => label.position[1])).size !== labels.length) {
      return [{ commit: node.getAttribute('data-commit'), reason: 'stack' }];
    }
    const typeRank = { tag: 0, localBranch: 1, remoteBranch: 2 };
    const orderedLabels = labels.sort((left, right) => left.position[1] - right.position[1]);
    return orderedLabels.some((label, index) => index > 0 && typeRank[label.type] < typeRank[orderedLabels[index - 1].type])
      ? [{ commit: node.getAttribute('data-commit'), reason: 'row-order' }]
      : [];
  }));
  if (invalidRefNodes.length) throw new Error(`Expected ref nodes to use an ordered vertical label stack without circles: ${JSON.stringify(invalidRefNodes)}`);
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
    return { right: window.innerWidth - rect.right, bottom: window.innerHeight - rect.bottom, height: rect.height };
  });
  if (zoomPosition.right !== 12 || zoomPosition.bottom !== 12 || zoomPosition.height !== 28) {
    throw new Error(`Expected zoom controls at the lower right: ${JSON.stringify(zoomPosition)}`);
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
  request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  if (request?.type !== 'showRefLog' || request.ref !== 'refs/heads/main') {
    throw new Error(`Unexpected ref history request: ${JSON.stringify(request)}`);
  }
  await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: window.__smokeRefLog })));
  await page.getByRole('heading', { name: 'Commit history' }).waitFor();
  await page.getByRole('button', { name: 'Show changes for f41acde1234567890' }).click();
  request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  if (request?.type !== 'showCommitDetails' || request.commit !== 'f41acde1234567890') {
    throw new Error(`Unexpected commit details request: ${JSON.stringify(request)}`);
  }
  await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: window.__smokeCommitDetails })));
  await page.getByText('14', { exact: false }).waitFor();
  await page.getByText('src/AuthService.ts').waitFor();
  await page.getByText('src/AuthService.ts').click();
  request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  if (request?.type !== 'openDiff' || request.left !== 'f41acde1234567890' || request.right !== 'e93b2101234567890' || request.path !== 'src/AuthService.ts' || request.status !== 'M') {
    throw new Error(`Unexpected commit file diff request: ${JSON.stringify(request)}`);
  }
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
