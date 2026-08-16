import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const screenshot = resolve(process.env.SMOKE_SCREENSHOT ?? join(root, 'artifacts/webview-smoke.png'));
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

  // Rendering: toolbar, refs, collapsed ranges, and vertical/horizontal SVG edges.
  if (await page.locator('.node').count() !== 6) throw new Error('Expected six commit nodes');
  if (await page.locator('.range').count() !== 2) throw new Error('Expected two collapsed ranges');
  await page.locator('.ref.localBranch').first().click();
  await page.getByRole('heading', { name: 'main' }).waitFor();

  // Interaction contract: compare intent is sent to VS Code, then its response renders.
  await page.locator('select').selectOption('refs/heads/develop');
  await page.getByRole('button', { name: 'Compare refs' }).click();
  const request = await page.evaluate(() => window.__vscodeMessages.at(-1));
  if (request?.type !== 'compareRefs' || request.right !== 'refs/heads/develop') {
    throw new Error(`Unexpected compare request: ${JSON.stringify(request)}`);
  }
  await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: window.__smokeComparison })));
  await page.getByText('532', { exact: false }).waitFor();
  await page.getByText('src/AuthService.ts').waitFor();

  await mkdir(resolve(screenshot, '..'), { recursive: true });
  await page.screenshot({ path: screenshot, fullPage: true });
  if (pageErrors.length) throw new Error(`Webview errors: ${pageErrors.join('; ')}`);
  console.log(`Webview smoke test passed. Screenshot: ${screenshot}`);
} finally {
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
