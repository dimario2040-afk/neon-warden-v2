import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
const file = process.argv[2];
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => errors.push(String(e).split('\n').slice(0,3).join(' | ')));
await page.goto(pathToFileURL(file).href);
await page.waitForTimeout(5000);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(900); }
await page.waitForTimeout(4000);
const state = await page.evaluate(() => ({
  stage: window.__NW_STAGE, err: window.__NW_ERR,
  game: window.__GAME__ ? { hp: window.__GAME__.player.hp, x: +window.__GAME__.player.x.toFixed(1), y: +window.__GAME__.player.y.toFixed(1), enemies: window.__GAME__.enemies.length, room: window.__GAME__.save ? Object.keys(window.__GAME__.save.visited) : null } : null,
  dbg: typeof window.__DBG,
}));
console.log('STATE:', JSON.stringify(state));
console.log('ERRORS:', errors.length ? errors.slice(0,10).join('\n') : 'none');
console.log('LOGS tail:', logs.slice(-6).join('\n'));
await page.screenshot({ path: process.argv[3] || 'shot2.png' });
await browser.close();
