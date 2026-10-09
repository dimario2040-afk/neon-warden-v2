import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', e => console.log('PAGEERR', String(e).split('\n')[0]));
await page.goto(new URL('../dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(800);
const info = await page.evaluate(() => { window.__DBG.cancelFade(); window.__DBG.tp('n5'); window.__DBG.killall(); return window.__GAME__.roomInfo('n5'); });
await page.waitForTimeout(350);
const lad = info.ladders[0];
await page.evaluate(([X,Y]) => { const p = window.__GAME__.player; p.x=X; p.y=Y; p.vx=0; p.vy=0; p.inv=30; }, [info.ox+lad.x, info.oy+info.F+0.05]);
await page.waitForTimeout(250);
await page.keyboard.down('KeyW');
for (let i=0;i<12;i++){ await page.waitForTimeout(500); console.log(i, await page.evaluate(() => ({ r: window.__GAME__.room, x:+window.__GAME__.player.x.toFixed(1), y:+window.__GAME__.player.y.toFixed(1), hp: window.__GAME__.player.hp, cl: window.__GAME__.player.climbing, death: window.__LASTDEATH || null }))); }
await page.keyboard.up('KeyW');
await browser.close();
