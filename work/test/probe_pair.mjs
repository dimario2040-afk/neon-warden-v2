import { chromium } from 'playwright-core';
import { ROOMS, ROOM_BY_ID } from '../../game/src/rooms.js';
const floorTop = (r, at) => { let f = 0; for (const [x,y,w,h] of r.solids) { if (h < 1.5 || y + h > 12.5) continue; if (Math.min(Math.abs(x-at), Math.abs(x+w-at)) < 5) f = Math.max(f, y+h); } return f; };
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', e => console.log('PAGEERR', String(e).split('\n')[0]));
await page.goto(new URL('../../game/dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(800);
await page.evaluate(() => { for (const a of ['servo','wall','hack2','phase']) window.__DBG.give(a); });
// пара 1: n3->n6 (как в сюите)
await page.evaluate(async () => { const G = window.__GAME__; window.__DBG.tp('n3'); window.__DBG.killboss(); await new Promise(r=>setTimeout(r,350)); G.player.inv=30; const i=G.roomInfo('n3'); const p=G.player; p.x=i.ox+14.6; p.y=i.oy+0+1.2; p.vx=0; p.vy=-6; await new Promise(r=>setTimeout(r,2500)); });
console.log('after pair1:', await page.evaluate(() => ({ r: window.__GAME__.room, x:+window.__GAME__.player.x.toFixed(1), y:+window.__GAME__.player.y.toFixed(1) })));
// пара 2: n6->st1
await page.evaluate(async () => { const G = window.__GAME__; window.__DBG.tp('n6'); window.__DBG.killboss(); await new Promise(r=>setTimeout(r,350)); G.player.inv=30; const i=G.roomInfo('n6'); const p=G.player; p.x=i.ox+20.6; p.y=i.oy+6+1.2; p.vx=0; p.vy=-6; });
for (let i=0;i<8;i++){ await page.waitForTimeout(250); console.log(i, await page.evaluate(() => { const p=window.__GAME__.player; const o=window.__GAME__.roomInfo(window.__GAME__.room); return JSON.stringify({ r: window.__GAME__.room, x:+(p.x-o.ox).toFixed(2), y:+(p.y-o.oy).toFixed(2), vy:+p.vy.toFixed(1), g:p.ground }); })); }
await browser.close();
