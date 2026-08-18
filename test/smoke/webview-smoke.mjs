import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const screenshot = resolve(process.env.SMOKE_SCREENSHOT ?? join(root, 'artifacts/webview-smoke.png'));
const imageDir = resolve(process.env.SMOKE_IMAGE_DIR ?? join(root, 'docs/images'));
const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.map': 'application/json' };
function startServer() { const server = createServer(async (request, response) => { try { const pathname = new URL(request.url ?? '/', 'http://localhost').pathname; const relative = pathname === '/' ? 'test/smoke/fixture.html' : pathname.slice(1); const file = normalize(join(root, relative)); if (!file.startsWith(`${root}${sep}`)) throw new Error('Path escapes fixture root'); response.setHeader('content-type', types[extname(file)] ?? 'application/octet-stream'); response.end(await readFile(file)); } catch { response.statusCode = 404; response.end('Not found'); } }); return new Promise(resolveServer => server.listen(0, '127.0.0.1', () => resolveServer(server))); }

const server = await startServer();
const address = server.address();
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
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

  if (await page.getByRole('tablist').count()) throw new Error('The viewer must expose only the Branches & merges view');
  if (await page.getByRole('button', { name: 'Git 関係図' }).count() || await page.getByRole('button', { name: 'コミット履歴' }).count()) throw new Error('Deprecated graph tabs must not render');
  if (await page.locator('.commit-node').count() !== 5) throw new Error('Expected five structural commits');
  if (await page.locator('.commit-group').count() !== 1) throw new Error('Expected the linear commit range to render as one summary group');
  if (await page.locator('.commit-edges path').count() !== 6) throw new Error('Expected summary graph edges');
  if (await page.locator('.ref.localBranch.current').count() !== 1) throw new Error('Expected exactly one current branch ref');
  if (!(await page.locator('.ref.localBranch.current').textContent()).includes('[HEAD]')) throw new Error('Expected the current branch HEAD marker');
  if (await page.locator('.ref.remoteBranch').count()) throw new Error('Remote refs must be hidden until enabled');
  await page.waitForFunction(() => document.querySelectorAll('.commit-node').length === 5);
  await page.screenshot({ path: join(imageDir, 'smoke-significant-commits.png'), fullPage: true });
  const branchCommitsCheckbox = page.getByRole('checkbox', { name: 'ブランチ関係のコミットを表示' });
  const summaryCheckbox = page.getByRole('checkbox', { name: 'コミットを概要表示' });
  const allCommitsCheckbox = page.getByRole('checkbox', { name: 'すべてのコミットを表示' });
  await branchCommitsCheckbox.uncheck();
  await page.waitForFunction(() => document.querySelectorAll('.commit-node').length === 0 && document.querySelectorAll('.commit-group').length === 0 && document.querySelectorAll('.ref').length === 4);
  if (await page.locator('.commit-edges path').count()) throw new Error('Ref-only mode must not render commit edges');
  await branchCommitsCheckbox.check();
  await page.waitForFunction(() => document.querySelectorAll('.commit-node').length === 5 && document.querySelectorAll('.commit-group').length === 1);
  await summaryCheckbox.uncheck();
  await page.waitForFunction(() => document.querySelectorAll('.commit-node').length === 5 && document.querySelectorAll('.commit-group').length === 0);
  await allCommitsCheckbox.check();
  await page.waitForFunction(() => document.querySelectorAll('.commit-node').length === 10 && document.querySelectorAll('.commit-group').length === 0);
  await allCommitsCheckbox.uncheck(); await summaryCheckbox.check();
  await page.waitForFunction(() => document.querySelectorAll('.commit-node').length === 5 && document.querySelectorAll('.commit-group').length === 1);

  let request;
  await page.locator('.commit-group .group-badge').click();
  request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  if (request?.type !== 'showCommitGroupDetails' || request.commits.length !== 5) throw new Error(`Unexpected summarized commit list request: ${JSON.stringify(request)}`);
  if (await page.locator('.ref-log .log-entry').count() !== 5) throw new Error('Expected every summarized commit to be listed in the commit history component');
  if (await page.locator('.commit-meta').count() !== 5) throw new Error('Expected committer and date metadata for every summarized commit');
  for (const subject of ['Add login validation', 'Add login form', 'Connect login form', 'Polish login errors', 'Add login tests']) await page.getByText(subject, { exact: true }).waitFor();
  await page.getByRole('button', { name: 'b16a9821234567890 の変更を表示' }).click();
  request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  if (request?.type !== 'showCommitDetails' || request.commit !== 'b16a9821234567890') throw new Error(`Unexpected summarized commit details request: ${JSON.stringify(request)}`);
  await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: window.__smokeGroupCommitDetails })));
  await page.getByText('src/LoginForm.tsx').waitFor();
  await page.getByText('Add login validation', { exact: true }).waitFor();
  await page.getByRole('button', { name: /src\/LoginForm\.tsx/ }).click();
  request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  if (request?.type !== 'openDiff' || request.left !== 'b16a9821234567890' || request.right !== 'c16a9821234567890' || request.path !== 'src/LoginForm.tsx') throw new Error(`Unexpected commit diff request: ${JSON.stringify(request)}`);

  await page.getByRole('button', { name: 'b16a9821234567890 の変更を表示' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: '変更を表示' }).waitFor();
  request = await page.evaluate(() => window.__vscodeMessages.filter(message => message?.type === 'contextMenu').at(-1));
  if (request?.nodeType !== 'commit' || request.nodeId !== 'b16a9821234567890') throw new Error(`Unexpected history commit context menu request: ${JSON.stringify(request)}`);
  await page.getByRole('menuitem', { name: '変更を表示' }).click();
  request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  if (request?.type !== 'showCommitDetails' || request.commit !== 'b16a9821234567890') throw new Error(`Unexpected history commit action: ${JSON.stringify(request)}`);

  await page.locator('.commit-node').first().locator('circle').click();
  request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  if (request?.type !== 'showCommitDetails' || request.commit !== 'f41acde1234567890') throw new Error(`Unexpected individual commit details request: ${JSON.stringify(request)}`);
  await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: window.__smokeCommitDetails })));
  await page.getByText('src/AuthService.ts').waitFor();
  await page.getByText('Polish relationship view', { exact: true }).waitFor();
  await page.locator('.commit-node').first().locator('circle').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'コミットメッセージをコピー' }).waitFor();
  request = await page.evaluate(() => window.__vscodeMessages.filter(message => message?.type === 'contextMenu').at(-1));
  if (request?.nodeType !== 'commit' || request.nodeId !== 'f41acde1234567890') throw new Error(`Unexpected graph commit context menu request: ${JSON.stringify(request)}`);
  await page.getByRole('menuitem', { name: 'コミットメッセージをコピー' }).click();
  request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  if (request?.type !== 'runContextCommand' || request.nodeType !== 'commit' || request.command !== 'copyMessage') throw new Error(`Unexpected graph commit action: ${JSON.stringify(request)}`);

  await page.getByRole('button', { name: '詳細を隠す' }).click();
  if (await page.locator('aside').count()) throw new Error('Expected the details pane to be hidden');
  await page.screenshot({ path: join(imageDir, 'smoke-inspector-hidden.png'), fullPage: true });
  await page.getByRole('button', { name: '詳細を表示' }).click();
  await page.locator('aside').waitFor();

  await page.getByText('リモートブランチ').click();
  request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  if (request?.type !== 'setRefVisibility' || request.tags !== true || request.remotes !== true) throw new Error(`Unexpected ref visibility request: ${JSON.stringify(request)}`);
  await page.waitForFunction(() => {
    const transforms = [...document.querySelectorAll('.ref.remoteBranch')].map(element => element.getAttribute('transform'));
    return transforms.length === 2 && transforms[0] !== transforms[1];
  });
  const remoteLabels = await page.locator('.ref.remoteBranch').evaluateAll(elements => elements.map(element => element.getAttribute('transform')));
  if (remoteLabels.length !== 2 || remoteLabels[0] === remoteLabels[1]) throw new Error(`Expected stacked remote refs: ${JSON.stringify(remoteLabels)}`);

  request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  await page.locator('.ref.localBranch').first().click();
  await page.getByRole('heading', { name: 'main' }).waitFor();
  request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  if (request?.type !== 'showRefLog' || request.ref !== 'refs/heads/main') throw new Error(`Unexpected history request: ${JSON.stringify(request)}`);
  await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: window.__smokeMainLog })));
  await page.getByRole('heading', { name: 'コミット履歴' }).waitFor();
  await page.locator('.log-entry').filter({ hasText: 'Polish relationship view' }).click();
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
  await page.screenshot({ path: join(imageDir, 'webview-smoke.png'), fullPage: true });
  if (pageErrors.length) throw new Error(`Webview errors: ${pageErrors.join('; ')}`);
  console.log(`Webview smoke test passed. Screenshot: ${screenshot}`);
} finally { await browser.close(); await new Promise(resolveClose => server.close(resolveClose)); }
