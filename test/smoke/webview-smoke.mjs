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
page.on('pageerror', error => pageErrors.push(error.stack ?? error.message));

try {
  await page.goto(`http://127.0.0.1:${address.port}/test/smoke/fixture.html`, { waitUntil: 'networkidle' });
  try {
    await page.getByText('commerce-platform').waitFor();
  } catch (error) {
    if (pageErrors.length) throw new Error(`Webview errors before graph render: ${pageErrors.join('; ')}`);
    throw error;
  }
  await mkdir(imageDir, { recursive: true });
  await page.screenshot({ path: join(imageDir, 'smoke-main-screen.png'), fullPage: true });

  if (await page.locator('.node').count() !== 4) throw new Error('Expected four reference groups');
  if (await page.locator('.edges path').count() !== 3) throw new Error('Expected one branch-relation edge per ref group');
  if (await page.locator('.ref.remoteBranch').count()) throw new Error('Remote refs must be hidden until enabled');
  if (await page.locator('.range, .edge-count, .commit-node').count()) throw new Error('Commit ranges, commit counts, and commit nodes must not render in relation view');

  await page.getByRole('tab', { name: '分岐・マージ' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.commit-node').length === 5);
  await page.screenshot({ path: join(imageDir, 'smoke-significant-commits.png'), fullPage: true });
  await page.getByRole('tab', { name: 'Git 関係図' }).click();

  await page.evaluate(() => window.__dispatchGraph(true, false, false));
  await page.getByRole('tab', { name: 'コミット履歴' }).click();
  await page.getByText('コミット履歴を読み込めません。ビューアーを更新してからもう一度試してください。').waitFor();
  let request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  if (request?.type !== 'refresh') throw new Error(`Expected a refresh for a stale graph payload: ${JSON.stringify(request)}`);
  if (await page.locator('.commit-node').count()) throw new Error('Stale graph payload must not enter a blank commit-history view');
  await page.evaluate(() => window.__dispatchGraph());
  await page.getByText('コミット履歴を読み込めません。ビューアーを更新してからもう一度試してください。').waitFor({ state: 'detached' });

  await page.getByRole('button', { name: '詳細を隠す' }).click();
  if (await page.locator('aside').count()) throw new Error('Expected the details pane to be hidden');
  await page.screenshot({ path: join(imageDir, 'smoke-inspector-hidden.png'), fullPage: true });
  await page.getByRole('button', { name: '詳細を表示' }).click();
  await page.locator('aside').waitFor();

  await page.getByText('リモートブランチ').click();
  request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  if (request?.type !== 'setRefVisibility' || request.tags !== true || request.remotes !== true) throw new Error(`Unexpected ref visibility request: ${JSON.stringify(request)}`);
  const remoteLabels = await page.locator('.ref.remoteBranch').evaluateAll(elements => elements.map(element => element.getAttribute('transform')));
  if (remoteLabels.length !== 2 || remoteLabels[0] === remoteLabels[1]) throw new Error(`Expected stacked remote refs: ${JSON.stringify(remoteLabels)}`);

  await page.getByRole('tab', { name: 'コミット履歴' }).click();
  await page.locator('.commit-node').first().waitFor();
  if (await page.locator('.commit-node').count() !== 6) throw new Error('Expected every fixture commit in commit history mode');
  if (await page.locator('.commit-edges path').count() !== 6) throw new Error('Expected all direct parent edges in commit history mode');
  const mergeEdges = await page.locator('.commit-edges path').evaluateAll(paths => paths.filter(path => path.getAttribute('d')?.includes('250')).length);
  if (mergeEdges < 2) throw new Error('Expected visible divergence and merge lanes in commit history mode');
  await page.screenshot({ path: join(imageDir, 'smoke-commit-history.png'), fullPage: true });
  await page.getByRole('tab', { name: 'Git 関係図' }).click();
  await page.locator('.commit-node').waitFor({ state: 'detached' });

  await page.locator('.ref.localBranch').first().click();
  await page.getByRole('heading', { name: 'main' }).waitFor();
  request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  if (request?.type !== 'showRefLog' || request.ref !== 'refs/heads/main') throw new Error(`Unexpected history request: ${JSON.stringify(request)}`);
  await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: window.__smokeMainLog })));
  await page.getByRole('heading', { name: 'コミット履歴' }).waitFor();
  await page.getByRole('button', { name: 'f41acde1234567890 の変更を表示' }).click();
  request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  if (request?.type !== 'showCommitDetails' || request.commit !== 'f41acde1234567890') throw new Error(`Unexpected commit details request: ${JSON.stringify(request)}`);
  await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: window.__smokeCommitDetails })));
  await page.getByText('src/AuthService.ts').waitFor();
  await page.screenshot({ path: join(imageDir, 'smoke-branch-log.png'), fullPage: true });

  await page.getByRole('button', { name: 'feature/login ブランチ' }).click();
  request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  if (request?.type !== 'showRefLog' || request.ref !== 'refs/heads/feature/login') throw new Error(`Unexpected feature history request: ${JSON.stringify(request)}`);
  await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: window.__smokeFeatureLog })));
  await page.getByText('分岐点', { exact: true }).waitFor();
  await page.getByText('Release baseline', { exact: true }).waitFor();
  const resizeHandle = page.getByRole('separator', { name: '詳細ペインの幅を変更' });
  const initialInspectorWidth = await page.locator('aside').evaluate(element => element.getBoundingClientRect().width);
  const resizeBox = await resizeHandle.boundingBox();
  if (!resizeBox) throw new Error('Details pane resize handle is not visible');
  await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + 180); await page.mouse.down(); await page.mouse.move(resizeBox.x - 100, resizeBox.y + 180); await page.mouse.up();
  const resizedInspectorWidth = await page.locator('aside').evaluate(element => element.getBoundingClientRect().width);
  if (resizedInspectorWidth <= initialInspectorWidth + 50) throw new Error(`Expected details pane to grow, got ${initialInspectorWidth} -> ${resizedInspectorWidth}`);

  await page.locator('.ref.localBranch').first().click();
  await page.locator('.ref.localBranch').first().click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'マージベースを表示' }).waitFor();
  if (await page.getByRole('menuitem', { name: 'コミットを展開' }).count()) throw new Error('Commit expansion actions must not render');
  await page.screenshot({ path: join(imageDir, 'smoke-context-menu.png'), fullPage: true });
  await page.getByRole('menuitem', { name: '比較ベースとして選択' }).click();
  request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  if (request?.type !== 'runContextCommand' || request.command !== 'selectCompareBase') throw new Error(`Unexpected context command: ${JSON.stringify(request)}`);

  await page.getByRole('button', { name: 'develop ブランチ' }).click({ modifiers: ['Control'] });
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
