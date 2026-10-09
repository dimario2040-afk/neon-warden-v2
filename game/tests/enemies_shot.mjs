import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERR', String(e).split('\n')[0]));
await page.goto(new URL('../dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(800);
await page.evaluate(() => window.__DBG.give('servo'));
for (const [rid, shot] of [['n3','en_neon.png'],['p2','en_prom.png'],['st5','en_stoki.png']]) {
  await page.evaluate(r => window.__DBG.tp(r), rid);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: shot });
}
console.log('shots done');
await browser.close();
