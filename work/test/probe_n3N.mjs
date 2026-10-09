import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', e => console.log('PAGEERR', String(e).split('\n')[0]));
await page.goto(new URL('../../game/dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(800);
await page.evaluate(() => { for (const a of ['servo','wall','hack2','phase']) window.__DBG.give(a); });
await page.evaluate(async () => { const G = window.__GAME__; window.__DBG.tp('n3'); window.__DBG.killall(); await new Promise(r=>setTimeout(r,350)); const p=G.player; const i=G.roomInfo('n3'); p.x=i.ox+20+6; p.y=i.oy+19.2; p.vy=11.8; p.vx=0; p.inv=30; });
for (let i=0;i<10;i++){ await page.waitForTimeout(200); console.log(i, await page.evaluate(() => { const p=window.__GAME__.player; const o=window.__GAME__.roomInfo(window.__GAME__.room); return JSON.stringify({ r: window.__GAME__.room, x:+(p.x-o.ox).toFixed(2), y:+(p.y-o.oy).toFixed(2), vy:+p.vy.toFixed(1) }); })); }
await browser.close();
