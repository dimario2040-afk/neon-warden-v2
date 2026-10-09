import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto(new URL('../../game/dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(1000);
// inject probe: set vx directly
await page.evaluate(() => { window.__GAME__.player.vx = 6; });
await page.waitForTimeout(400);
console.log('after vx=6:', await page.evaluate(() => ({ x: +window.__GAME__.player.x.toFixed(1), vx: +window.__GAME__.player.vx.toFixed(1) })));
// synthetic KeyD event
await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', bubbles: true })); });
await page.waitForTimeout(400);
console.log('after synth KeyD:', await page.evaluate(() => ({ x: +window.__GAME__.player.x.toFixed(1), vx: +window.__GAME__.player.vx.toFixed(1) })));
await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' })); });
// real key
await page.keyboard.down('KeyD'); await page.waitForTimeout(400);
console.log('after real KeyD:', await page.evaluate(() => ({ x: +window.__GAME__.player.x.toFixed(1), vx: +window.__GAME__.player.vx.toFixed(1) })));
await page.keyboard.up('KeyD');
await browser.close();
