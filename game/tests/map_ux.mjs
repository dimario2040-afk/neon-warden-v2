import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERR', String(e).split('\n')[0]));
await page.goto(new URL('../dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(800);
const visited = ['n1','n2','n3','n4','n5','n6','n7','n8','n9','p1','p2','p3','p4','p5','p6','p7','p8','m1','m2','m3','m4','m5','st1','st2','st3','st4','st5'];
for (const id of visited) { await page.evaluate(r => window.__DBG.tp(r), id); await page.waitForTimeout(70); }
await page.evaluate(() => { for (const a of ['servo','wall','hack2']) window.__DBG.give(a); window.__DBG.save().cores.push('core_prom','core_stoki'); });
await page.waitForTimeout(300);
await page.keyboard.press('Tab'); await page.waitForTimeout(800);
await page.screenshot({ path: 'map_ux.png' });
const goals = await page.evaluate(() => document.getElementById('mapGoals')?.textContent);
console.log('GOALS:', goals);
await page.keyboard.press('Tab');
// gate message check: stand at p4 east gate
await page.evaluate(() => { window.__DBG.tp('p4'); const G = window.__GAME__; const info = G.roomInfo('p4'); G.player.x = info.ox + 35; G.player.y = info.oy + 0.05; }); await page.waitForTimeout(400);
await page.keyboard.down('KeyD'); await page.waitForTimeout(1200); await page.keyboard.up('KeyD'); await page.waitForTimeout(300);
const msg = await page.evaluate(() => document.getElementById('message')?.textContent);
console.log('GATE MSG p4→E:', msg);
await page.screenshot({ path: 'gate_msg.png' });
await browser.close();
