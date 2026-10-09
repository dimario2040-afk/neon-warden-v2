import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', e => console.log('PAGEERR', String(e).split('\n')[0]));
await page.goto(new URL('../../game/dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(800);
// симулируем tp во время фейда: beginTransition затем tp
await page.evaluate(() => { window.__DBG.tp('n6'); });
await page.waitForTimeout(300);
await page.evaluate(() => { const G = window.__GAME__; const i = G.roomInfo('n6'); const p = G.player; p.x = i.ox + 20.6; p.y = i.oy + 7.2; p.vy = -6; });
await page.waitForTimeout(200);
await page.evaluate(() => { window.__DBG.tp('p2'); });   // tp во время возможного фейда
await page.waitForTimeout(400);
console.log('overlay:', await page.evaluate(() => [...document.querySelectorAll('div,pre')].map(d => d.textContent||'').filter(t => t.includes('LOOP ERROR')).join('|').slice(0,400) || 'none'));
console.log('state:', await page.evaluate(() => ({ r: window.__GAME__.room, y: +window.__GAME__.player.y.toFixed(1) })));
// жив ли луп: подвигаем игрока
await page.evaluate(() => { window.__GAME__.player.vx = 5; });
await page.waitForTimeout(500);
console.log('after vx=5:', await page.evaluate(() => +window.__GAME__.player.x.toFixed(1)));
await browser.close();
