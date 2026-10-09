import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', e => console.log('PAGEERR', String(e).split('\n')[0]));
await page.goto(new URL('../../game/dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(800);
await page.evaluate(() => { for (const a of ['servo','wall','hack2','phase']) window.__DBG.give(a); window.__DBG.tp('s5'); window.__DBG.killall(); });
await page.waitForTimeout(400);
await page.evaluate(() => { const G = window.__GAME__; const i = G.roomInfo('s5'); const p = G.player; p.x = i.ox + 34; p.y = i.oy + 8.05; p.vx = 0; p.vy = -3; p.inv = 30; });
for (let i=0;i<10;i++){ await page.waitForTimeout(200); console.log(i, await page.evaluate(() => { const p = window.__GAME__.player; const o = window.__GAME__.roomInfo(window.__GAME__.room); return JSON.stringify({ r: window.__GAME__.room, x:+(p.x-o.ox).toFixed(2), y:+(p.y-o.oy).toFixed(2), vy:+p.vy.toFixed(1), g:p.ground }); })); }
await browser.close();
