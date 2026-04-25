import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';
import pngToIco from 'png-to-ico';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function screenshot(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  htmlName: string,
  outName: string,
  width: number,
  height: number,
): Promise<void> {
  const page = await browser.newPage({ viewport: { width, height } });
  const fileUrl = `file://${join(root, 'scripts', htmlName)}`;
  await page.goto(fileUrl);
  await page.screenshot({
    path: join(root, 'public', outName),
    omitBackground: false,
  });
  await page.close();
}

async function main(): Promise<void> {
  const browser = await chromium.launch();
  try {
    await screenshot(browser, 'brand-og.html', 'og.png', 1200, 630);
    await screenshot(browser, 'brand-icon.html', 'apple-touch-icon.png', 180, 180);
    await screenshot(browser, 'brand-icon.html', '_icon-32.png', 32, 32);
    await screenshot(browser, 'brand-icon.html', '_icon-16.png', 16, 16);
  } finally {
    await browser.close();
  }

  const icoBuf = await pngToIco([
    readFileSync(join(root, 'public', '_icon-16.png')),
    readFileSync(join(root, 'public', '_icon-32.png')),
  ]);
  writeFileSync(join(root, 'public', 'favicon.ico'), icoBuf);
  unlinkSync(join(root, 'public', '_icon-16.png'));
  unlinkSync(join(root, 'public', '_icon-32.png'));
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
