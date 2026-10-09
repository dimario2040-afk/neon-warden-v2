import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e).split('\n')[0]));
await page.goto(new URL('../../game/dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(1000);
let fail = 0; const ok = (c, m) => { console.log((c ? '  OK  ' : ' FAIL ') + m); if (!c) fail++; };
// 1) fx leak: swing+dash+burst -> все эффекты должны умереть
const base = await page.evaluate(() => window.__GAME__.sceneChildren);
await page.keyboard.press('KeyJ'); await page.waitForTimeout(120);
await page.keyboard.press('KeyK'); await page.waitForTimeout(120);
await page.keyboard.press('KeyJ'); await page.waitForTimeout(120);
await page.keyboard.press('Space'); await page.waitForTimeout(2500);
const after = await page.evaluate(() => ({ sc: window.__GAME__.sceneChildren, fx: window.__GAME__.fxCount }));
ok(after.fx === 0, 'fx mesh list empty after 2.5s (got ' + after.fx + ')');
ok(after.sc <= base + 2, 'scene children back to baseline (' + base + ' -> ' + after.sc + ')');
// 2) parallax per biome screenshots
for (const [rid, shot] of [['n1','px_neon.png'],['p2','px_prom.png'],['m2','px_mega.png'],['st2','px_stoki.png'],['pu2','px_pusto.png'],['s2','px_set.png']]) {
  await page.evaluate(r => { window.__DBG.showParallax(); window.__DBG.tp(r); }, rid); await page.waitForTimeout(700);
  await page.screenshot({ path: shot });
}
ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors[0] : ''));
console.log(fail === 0 ? 'FX+PARALLAX: PASS' : 'FX+PARALLAX: ' + fail + ' FAILURES');
await browser.close();
process.exit(fail === 0 ? 0 : 1);
