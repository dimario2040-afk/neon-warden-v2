import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', e => console.log('PAGEERR', String(e).split('\n')[0]));
await page.goto(new URL('../dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(800);
for (const rid of ['n5']) {
  const info = await page.evaluate(r => { window.__DBG.cancelFade(); window.__DBG.tp(r); window.__DBG.killall(); return window.__GAME__.roomInfo(r); }, rid);
  await page.waitForTimeout(300);
  const lad = info.ladders[0];
  await page.evaluate(([X,Y]) => { const p = window.__GAME__.player; p.x=X; p.y=Y; p.vx=0; p.vy=0; p.inv=30; }, [info.ox+lad.x, info.oy+info.F+0.05]);
  await page.waitForTimeout(200);
  await page.keyboard.down('KeyW');
  for (let i=0;i<10;i++){ await page.waitForTimeout(300); console.log(rid, i, await page.evaluate(r => { const p=window.__GAME__.player; const o=window.__GAME__.roomInfo(r); return JSON.stringify({x:+(p.x-o.ox).toFixed(2), y:+(p.y-o.oy).toFixed(2), climb:p.climbing, onL:p.onLadder}); }, rid)); }
  await page.keyboard.up('KeyW');
}
await browser.close();
