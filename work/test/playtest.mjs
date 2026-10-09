import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e).split('\n')[0]));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 160)); });
await page.goto(new URL('../../game/dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4500);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(800); }
await page.waitForTimeout(2500);
const room = () => page.evaluate(() => window.__GAME__.room);
const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
const runJump = async (ms, inv = false) => { // умный бот: прыгает только перед дыркой; inv=тест геометрии/гейтов без боёвки
  const t0 = Date.now();
  await page.keyboard.down('KeyD');
  while (Date.now() - t0 < ms) {
    if (inv) await page.evaluate(() => { window.__GAME__.player.inv = 5; });
    const gap = await page.evaluate(() => window.__GAME__.gapAhead());
    const g = await page.evaluate(() => window.__GAME__.player.ground);
    if (gap && g) { await page.keyboard.down('Space'); await page.waitForTimeout(450); await page.keyboard.up('Space'); }
    await page.waitForTimeout(120);
  }
  await page.keyboard.up('KeyD');
};
let fail = 0; const ok = (c, m) => { console.log((c ? '  OK  ' : ' FAIL ') + m); if (!c) fail++; };

ok(await room() === 'n1', 'start room n1');
{ let t = 0; while (t < 20000 && !(await room() === 'n2')) { await runJump(2600); t += 2600; } }
const r1 = await room();
ok(r1 === 'n2' || r1 === 'n9', 'door transition fired from n1 (got ' + r1 + '; n9 = S-лаз в подвал, тоже переход)');
if (r1 === 'n9') await page.evaluate(() => window.__DBG.tp('n2'));

await page.evaluate(() => window.__DBG.tp('n8')); await page.waitForTimeout(600);
await runJump(2600);
ok(await room() === 'n8', 'gate servo blocks n8→p1 without ability');
await page.evaluate(() => window.__DBG.give('servo')); await page.waitForTimeout(300);
{ let t = 0; while (t < 16000 && !(await room() === 'p1')) { await runJump(2600, true); t += 2600; } }
ok(await room() === 'p1', 'gate opens with servo → p1 (got ' + await room() + ')');

await page.evaluate(() => window.__DBG.tp('n4')); await page.waitForTimeout(600);
{ // подход к терминалу (x=144) с обратной связью
  const px = () => page.evaluate(() => window.__GAME__.player.x);
  await hold('KeyD', 900);
  for (let i = 0; i < 12 && (await px()) < 143.2; i++) await hold('KeyD', 120);
  await page.waitForTimeout(200);
}
for (let i = 0; i < 3 && !(await page.evaluate(() => window.__GAME__.save.bench?.room === 'n4')); i++) { await page.keyboard.press('KeyE'); await page.waitForTimeout(400); }
ok(await page.evaluate(() => window.__GAME__.save.bench?.room === 'n4'), 'bench save at n4 terminal');

await page.evaluate(() => { window.__GAME__.player.hp = 1; window.__DBG.tp('n6'); });
await page.keyboard.down('KeyD'); await page.waitForTimeout(1800); await page.keyboard.up('KeyD');
await page.waitForTimeout(1500);
ok(await room() === 'n4', 'acid death → respawn at last bench n4 (got ' + await room() + ')');
ok(await page.evaluate(() => window.__GAME__.player.hp === window.__GAME__.player.maxHp), 'respawn full HP');

await page.evaluate(() => window.__DBG.tp('n7')); await page.waitForTimeout(900);
await page.evaluate(() => window.__DBG.killboss()); await page.waitForTimeout(600);
ok(await page.evaluate(() => window.__GAME__.save.bosses.includes('rain_hunter')), 'boss rain_hunter dead → drop recorded');
ok(await page.evaluate(() => window.__GAME__.save.abilities.servo === true), 'servo granted by boss drop');

await page.evaluate(() => window.__DBG.tp('p4')); await page.waitForTimeout(500);
await hold('KeyD', 2600);
ok(await room() === 'p4', 'phase gate blocks p4→pu1');

// регрессия: переход ВВЕРХ через потолочный люк (n3→n5) и обратно вниз (n5→n3) — без смерти
await page.evaluate(() => window.__DBG.tp('n3')); await page.waitForTimeout(500);
await page.evaluate(() => { const p = window.__GAME__.player; p.x = 108; p.y = -83.5; p.vy = 6; p.vx = 0; });
await page.waitForTimeout(1200);
ok(await room() === 'n5', 'N-hatch transition up n3→n5 (got ' + await room() + ')');
{ const st = await page.evaluate(() => ({ hp: window.__GAME__.player.hp, max: window.__GAME__.player.maxHp, y: +window.__GAME__.player.y.toFixed(1) }));
  ok(st.hp === st.max && st.y > -80, 'alive & standing after up-transition (hp ' + st.hp + ', y ' + st.y + ')'); }
await page.waitForTimeout(800);
ok(await room() === 'n5', 'no ping-pong back through the hole (still ' + await room() + ')');
await page.evaluate(() => { const p = window.__GAME__.player; p.x = 108; p.y = -76; p.vy = -4; p.vx = 0; });
await page.waitForTimeout(1500);
ok(await room() === 'n3', 'S-hole transition down n5→n3 (got ' + await room() + ')');
{ const st = await page.evaluate(() => ({ hp: window.__GAME__.player.hp, max: window.__GAME__.player.maxHp }));
  ok(st.hp === st.max, 'alive after down-transition (hp ' + st.hp + ')'); }

await page.keyboard.press('Tab'); await page.waitForTimeout(700);
ok(await page.evaluate(() => document.getElementById('mapOverlay')?.style.display === 'flex'), 'map overlay opens (Tab)');
await page.screenshot({ path: 'v2_map.png' });
await page.keyboard.press('Tab'); await page.waitForTimeout(300);

await page.keyboard.press('F2'); await page.waitForTimeout(500);
await page.screenshot({ path: 'v2_col.png' });
await page.keyboard.press('F2');
await page.keyboard.press('F4'); await page.waitForTimeout(600);
await page.screenshot({ path: 'v2_graph.png' });
await page.keyboard.press('F4');

for (const [rid, shot] of [['p2','v2_prom.png'],['m2','v2_mega.png'],['st2','v2_stoki.png'],['pu2','v2_pusto.png'],['s2','v2_set.png']]) {
  await page.evaluate(r => window.__DBG.tp(r), rid); await page.waitForTimeout(900);
  await page.screenshot({ path: shot });
}
await page.keyboard.press('F1'); await page.waitForTimeout(300);
await page.keyboard.press('F5'); await page.waitForTimeout(300);
await page.keyboard.press('F6'); await page.waitForTimeout(300);
await page.screenshot({ path: 'v2_debug.png' });
await page.keyboard.press('F1'); await page.keyboard.press('F5'); await page.keyboard.press('F6');
const fps = await page.evaluate(() => window.__DBG.fps());
console.log('  FPS(swiftshader):', Math.round(fps));
ok(fps > 20, 'fps > 20 on software GL (got ' + Math.round(fps) + ')');
ok(errors.length === 0, 'no page/console errors during playtest' + (errors.length ? ': ' + errors.slice(0,5).join(' | ') : ''));
console.log(fail === 0 ? '\nPLAYTEST: PASS' : `\nPLAYTEST: ${fail} FAILURES`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
