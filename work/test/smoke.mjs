import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';

const file = process.argv[2];
const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [], errors = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => errors.push(String(e).split('\n')[0]));

await page.goto(pathToFileURL(file).href);
await page.waitForTimeout(6000);

// try to get past menu: Enter (splash->title), Enter (title->creation), Enter (creation->play)
for (const k of ['Enter','Enter','Enter']) {
  await page.keyboard.press(k);
  await page.waitForTimeout(1200);
}
await page.waitForTimeout(3000);

const state = await page.evaluate(() => {
  const g = window.__GAME__;
  return {
    stage: window.__NW_STAGE, err: window.__NW_ERR, mm: window.__NW_MMERR,
    boot: g ? { hp: g.player.hp, x: +g.player.x.toFixed(1), y: +g.player.y.toFixed(1), enemies: g.enemies.length, solids: g.solids.length } : null,
  };
});
console.log('STATE:', JSON.stringify(state, null, 1));
console.log('ERRORS:', errors.length ? errors.slice(0, 8).join('\n') : 'none');
const relevant = logs.filter(l => !/Download the React|favicon/.test(l));
console.log('CONSOLE (last 12):', relevant.slice(-12).join('\n') || 'none');
await page.screenshot({ path: process.argv[3] || 'shot.png' });
await browser.close();
