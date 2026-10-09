import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', e => console.log('PAGEERR', String(e).split('\n')[0]));
await page.goto(new URL('../../game/dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(1000);
await page.evaluate(() => window.__DBG.tp('n4')); await page.waitForTimeout(500);
await page.keyboard.down('KeyD'); await page.waitForTimeout(1400); await page.keyboard.up('KeyD');
await page.waitForTimeout(200);
console.log('pos:', await page.evaluate(() => { const p = window.__GAME__.player; return JSON.stringify({ x:+p.x.toFixed(1), y:+p.y.toFixed(1), g:p.ground }); }));
await page.keyboard.press('KeyE'); await page.waitForTimeout(400);
console.log('bench:', await page.evaluate(() => JSON.stringify(window.__GAME__.save.bench)));
console.log('items n4:', await page.evaluate(() => JSON.stringify(window.__DBG.save ? 1 : 0)));
await browser.close();
