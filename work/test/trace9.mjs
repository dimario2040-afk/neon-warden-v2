import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERR', String(e).split('\n')[0]));
await page.goto(new URL('../../game/dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(1000);
const runJump = async (ms) => { const t0 = Date.now(); await page.keyboard.down('KeyD'); while (Date.now() - t0 < ms) { await page.keyboard.press('Space'); await page.waitForTimeout(650); } await page.keyboard.up('KeyD'); };
const room = () => page.evaluate(() => window.__GAME__.room);
await page.evaluate(() => window.__DBG.tp('n8')); await page.waitForTimeout(600);
await runJump(2600);
await page.evaluate(() => window.__DBG.give('servo')); await page.waitForTimeout(300);
{ let t = 0; while (t < 16000 && !(await room() === 'p1')) { await runJump(2600); t += 2600; } }
console.log('room now', await room());
await page.evaluate(() => window.__DBG.tp('n4')); await page.waitForTimeout(600);
await page.keyboard.down('KeyD'); await page.waitForTimeout(1400); await page.keyboard.up('KeyD'); await page.waitForTimeout(200);
console.log('pos', await page.evaluate(() => { const p = window.__GAME__.player; return JSON.stringify({ r: window.__GAME__.room, x:+p.x.toFixed(1), y:+p.y.toFixed(1) }); }));
await page.keyboard.press('KeyE'); await page.waitForTimeout(400);
console.log('bench', await page.evaluate(() => JSON.stringify(window.__GAME__.save.bench)));
await browser.close();
