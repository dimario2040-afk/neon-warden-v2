import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto(new URL('../../game/dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(1000);
await page.keyboard.down('KeyD');
await page.waitForTimeout(300);
console.log('keys:', await page.evaluate(() => JSON.stringify(window.__KEYS)));
console.log('focused el:', await page.evaluate(() => document.activeElement?.tagName + '#' + document.activeElement?.id));
await page.keyboard.up('KeyD');
await browser.close();
