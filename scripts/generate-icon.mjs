import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourcePath = resolve(root, 'resources/topology.svg');
const outputPath = resolve(root, 'resources/topology.png');
const source = await readFile(sourcePath, 'utf8');
const innerSvg = source
  .replace(/^\s*<svg\b[^>]*>/i, '')
  .replace(/<\/svg>\s*$/i, '')
  .trim();

if (!innerSvg) throw new Error(`No SVG content found in ${sourcePath}`);

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect x="2" y="2" width="124" height="124" rx="26" fill="#1f6feb"/><g transform="translate(28 28) scale(3)" style="color:#ffffff">${innerSvg}</g></svg>`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({
    viewport: { width: 128, height: 128 },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<body style="margin:0;background:transparent">${iconSvg}</body>`);
  await page.screenshot({ path: outputPath, omitBackground: true });
} finally {
  await browser.close();
}

console.log(`Generated ${outputPath} from ${sourcePath}`);
