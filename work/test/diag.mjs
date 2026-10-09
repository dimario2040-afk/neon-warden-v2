import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERR', String(e).split('\n')[0]));
await page.goto(pathToFileURL(process.argv[2]).href);
await page.waitForTimeout(4000);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(3000);
const d = await page.evaluate(() => {
  const g = window.__GAME__;
  return g ? g.diag() : 'no __GAME__.diag';
});
console.log(JSON.stringify(d, null, 1));
await browser.close();
