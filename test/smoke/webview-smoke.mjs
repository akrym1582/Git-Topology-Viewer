import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const screenshot = resolve(process.env.SMOKE_SCREENSHOT ?? join(root, 'artifacts/webview-smoke.png'));
const imageDir = resolve(root, 'docs/images');
const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.map': 'application/json' };
function startServer() { const server = createServer(async (request, response) => { try { const pathname = new URL(request.url ?? '/', 'http://localhost').pathname; const relative = pathname === '/' ? 'test/smoke/fixture.html' : pathname.slice(1); const file = normalize(join(root, relative)); if (!file.startsWith(`${root}${sep}`)) throw new Error('Path escapes fixture root'); response.setHeader('content-type', types[extname(file)] ?? 'application/octet-stream'); response.end(await readFile(file)); } catch { response.statusCode = 404; response.end('Not found'); } }); return new Promise(resolveServer => server.listen(0, '127.0.0.1', () => resolveServer(server))); }

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

  if (await page.locator('.node').count() !== 4) throw new Error('Expected four reference groups');
  if (await page.locator('.edges path').count() !== 4) throw new Error('Expected four branch-relation edges');
  if (await page.locator('.ref.remoteBranch').count()) throw new Error('Remote refs must be hidden until enabled');
  if (await page.locator('.range, .edge-count, .node circle').count()) throw new Error('Commit ranges, commit counts, and commit nodes must not render');
  if (await page.getByText('トポロジー', { exact: true }).count()) throw new Error('Commit view modes must not render');
  if (await page.getByText('コミット ID', { exact: true }).count()) throw new Error('Commit controls must not render');

  await page.getByRole('button', { name: '詳細を隠す' }).click();
  if (await page.locator('aside').count()) throw new Error('Expected the details pane to be hidden');
  await page.screenshot({ path: join(imageDir, 'smoke-inspector-hidden.png'), fullPage: true });
  await page.getByRole('button', { name: '詳細を表示' }).click();
  await page.locator('aside').waitFor();

  await page.getByText('リモートブランチ').click();
  let request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  if (request?.type !== 'setRefVisibility' || request.tags !== true || request.remotes !== true) throw new Error(`Unexpected ref visibility request: ${JSON.stringify(request)}`);
  const remoteLabels = await page.locator('.ref.remoteBranch').evaluateAll(elements => elements.map(element => element.getAttribute('transform')));
  if (remoteLabels.length !== 2 || remoteLabels[0] === remoteLabels[1]) throw new Error(`Expected stacked remote refs: ${JSON.stringify(remoteLabels)}`);

  await page.locator('.ref.localBranch').first().click();
  await page.getByRole('heading', { name: 'main' }).waitFor();
  if (await page.getByRole('heading', { name: 'コミット履歴' }).count()) throw new Error('Commit history must not render');
  const resizeHandle = page.getByRole('separator', { name: '詳細ペインの幅を変更' });
  const initialInspectorWidth = await page.locator('aside').evaluate(element => element.getBoundingClientRect().width);
  const resizeBox = await resizeHandle.boundingBox();
  if (!resizeBox) throw new Error('Details pane resize handle is not visible');
  await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + 180); await page.mouse.down(); await page.mouse.move(resizeBox.x - 100, resizeBox.y + 180); await page.mouse.up();
  const resizedInspectorWidth = await page.locator('aside').evaluate(element => element.getBoundingClientRect().width);
  if (resizedInspectorWidth <= initialInspectorWidth + 50) throw new Error(`Expected details pane to grow, got ${initialInspectorWidth} -> ${resizedInspectorWidth}`);

  await page.locator('.ref.localBranch').first().click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'マージベースを表示' }).waitFor();
  if (await page.getByRole('menuitem', { name: 'コミットを展開' }).count()) throw new Error('Commit expansion actions must not render');
  await page.screenshot({ path: join(imageDir, 'smoke-context-menu.png'), fullPage: true });
  await page.getByRole('menuitem', { name: '比較ベースとして選択' }).click();
  request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  if (request?.type !== 'runContextCommand' || request.command !== 'selectCompareBase') throw new Error(`Unexpected context command: ${JSON.stringify(request)}`);

  await page.locator('.ref.localBranch').nth(2).click({ modifiers: ['Control'] });
  request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  if (request?.type !== 'compareRefs' || request.left !== 'refs/heads/main' || request.right !== 'refs/heads/develop') throw new Error(`Unexpected Ctrl-click comparison: ${JSON.stringify(request)}`);
  await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: window.__smokeComparison })));
  await page.getByRole('heading', { name: '比較', exact: true }).waitFor();
  await page.getByText('src/AuthService.ts').waitFor();
  await page.screenshot({ path: join(imageDir, 'smoke-branch-comparison-context-menu.png'), fullPage: true });

  await mkdir(resolve(screenshot, '..'), { recursive: true });
  await page.screenshot({ path: screenshot, fullPage: true });
  if (pageErrors.length) throw new Error(`Webview errors: ${pageErrors.join('; ')}`);
  console.log(`Webview smoke test passed. Screenshot: ${screenshot}`);
} finally { await browser.close(); await new Promise(resolveClose => server.close(resolveClose)); }
