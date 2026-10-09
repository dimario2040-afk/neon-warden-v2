// bosses_visual.mjs — все боссы: визуал в рамках арены + без рассинхрона с хитбоксом.
import { chromium } from 'playwright-core';
const BOSSES = [ ['rain_hunter','n7'], ['overseer','m3'], ['press_777','p6'], ['brood_mother','st4'], ['sirokko','pu4'], ['architect','s4'], ['glitch_mother','s5'] ];
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e).split('\n')[0]));
await page.goto(new URL('../dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(900);
await page.evaluate(() => { for (const a of ['servo','wall','hack2','phase']) window.__DBG.give(a); });
let fail = 0;
for (const [bid, rid] of BOSSES) {
  const res = await page.evaluate(async ([bid, rid]) => {
    const G = window.__GAME__;
    window.__DBG.tp(rid);
    await new Promise(r => setTimeout(r, 400));
    const info = G.roomInfo(rid);
    let worst = 0, outX = 0, outY = 0, desync = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 9000) {
      await new Promise(r => setTimeout(r, 120));
      const e = G.enemies.find(x => x.t === bid);
      if (!e || e.dead) continue;
      G.player.inv = 5; G.player.hp = G.player.maxHp;
      const vx = e.g.position.x, vy = e.g.position.y;
      if (vx < info.ox + 0.3 || vx > info.ox + info.w - 0.3) outX++;
      if (vy < info.oy - 1.7 || vy > info.oy + info.h - 1.5) outY++;
      const dx = Math.abs(vx - e.x), dy = Math.abs(vy - e.y);
      if (Math.max(dx, dy) > desync) desync = Math.max(dx, dy);
      worst = Math.max(worst, outX + outY);
    }
    return { outX, outY, desync: +desync.toFixed(2) };
  }, [bid, rid]);
  const okk = res.outX === 0 && res.outY === 0 && res.desync < 1.2;
  if (!okk) fail++;
  console.log((okk ? '  OK  ' : ' FAIL ') + `${bid} @${rid}: outX=${res.outX} outY=${res.outY} desync=${res.desync}`);
}
console.log('errors:', errors.length ? errors.slice(0,3).join(' | ') : 'none');
console.log(fail === 0 ? 'BOSSES VISUAL: PASS' : `BOSSES VISUAL: ${fail} FAILURES`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
