import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(new URL('../dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(800);
await page.evaluate(() => { window.__DBG.tp('s4'); });
await page.waitForTimeout(2500);
await page.evaluate(() => { window.__GAME__.player.inv = 20; });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'arch_after.png' });
const pos = await page.evaluate(() => { const e = window.__GAME__.enemies.find(x => x.t === 'architect'); const i = window.__GAME__.roomInfo('s4'); return { st: e.bstate, vx: +e.g.position.x.toFixed(1), vy: +e.g.position.y.toFixed(1), ly: +e.y.toFixed(1), oy: i.oy, floor: i.F }; });
console.log(JSON.stringify(pos));
await browser.close();
