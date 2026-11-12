import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { SIZE } from './template.js';

let browser;
export async function openBrowser() {
  if (!browser) {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  }
  return browser;
}
export async function closeBrowser() { if (browser) { await browser.close(); browser = null; } }

// Writes the HTML next to the output (so file:// fonts/images load) and screenshots it.
export async function renderPNG(html, outPng) {
  const b = await openBrowser();
  const htmlPath = outPng.replace(/\.png$/, '.html');
  fs.mkdirSync(path.dirname(outPng), { recursive: true });
  fs.writeFileSync(htmlPath, html);
  const page = await b.newPage({ viewport: { width: SIZE.W, height: SIZE.H }, deviceScaleFactor: 1 });
  await page.goto('file://' + htmlPath, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await page.screenshot({ path: outPng, type: 'png', clip: { x: 0, y: 0, width: SIZE.W, height: SIZE.H } });
  await page.close();
  fs.rmSync(htmlPath, { force: true });
  return outPng;
}
