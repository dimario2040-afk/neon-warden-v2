// rechain3.mjs — v2.3 «жёсткий мир + лестничные шахты»: цепи убираем, вертикаль = LADDER (Metroid-shaft),
// полки = сплошные боевые/лут-платформы (3 шт., разреженно, вне колонны лестницы и коридоров).
import { readFileSync, writeFileSync } from 'fs';
import { ROOMS } from '../src/rooms.js';
let src = readFileSync('src/rooms.js', 'utf-8');
const fmt = (v) => String(Math.round(v * 10) / 10);
const log = [];
for (const r of ROOMS) {
  const dn = (r.doors || []).find(d => d.s === 'N');
  if (!dn) continue;
  let F = 0;
  for (const [x, y, w, h] of r.solids) if (h >= 1.5 && y + h <= 12.5) F = Math.max(F, y + h);
  const floors = r.solids.filter(s => s[3] >= 1.5);
  const keep = r.solids.filter(s => s[3] <= 0.7 && s[1] + s[3] <= F + 2.0);
  const dropped = r.solids.filter(s => s[3] <= 0.7 && s[1] + s[3] > F + 2.0);
  const at = dn.at;
  const L = (at + 4 <= r.w - 2) ? at + 4 : at - 4;          // лестница рядом с люком (вне S-дырки at±1.2): hop с верха лестницы в люк
  const shelves = [
    [Math.max(1, Math.min(r.w - 5, at - 9)), Math.round((F + 2.1) * 10) / 10, 4, 0.6],
    [Math.max(1, Math.min(r.w - 5, at + 10)), Math.round((F + 6.4) * 10) / 10, 4, 0.6],
    [Math.max(1, Math.min(r.w - 5, at - 8)), Math.round((F + 10.6) * 10) / 10, 4, 0.6],
  ].filter(sh => Math.abs(sh[0] + 2 - L) > 3);               // не над лестницей
  const newSolids = [...floors, ...keep, ...shelves];
  const ladder = { x: L, y0: F, y1: 19.2 };
  const remapXY = (x, y, isChest) => {
    const sup = dropped.find(s => x >= s[0] - .5 && x <= s[0] + s[2] + .5 && Math.abs(y - (s[1] + s[3])) < 0.06);
    if (!sup) return null;
    if (isChest && shelves[0]) { const b = shelves[0]; return [Math.min(b[0] + 3.4, Math.max(b[0] + 0.6, x)), b[1] + b[3]]; }
    let best = null, bd = 1e9;
    for (const sh of shelves) { const d = Math.abs(sh[0] + 2 - x) + Math.abs(sh[1] + sh[3] - y) * .3; if (d < bd) { bd = d; best = sh; } }
    return [Math.min(best[0] + 3.4, Math.max(best[0] + 0.6, x)), best[1] + best[3]];
  };
  const i0 = src.indexOf(`id:"${r.id}"`);
  const i1 = src.indexOf('R({', i0 + 10);
  let seg = src.slice(i0, i1 === -1 ? undefined : i1);
  seg = seg.replace(/solids:\[.*?\]\],/s, 'solids:' + JSON.stringify(newSolids) + ',');
  // ladders: заменить/добавить
  if (/ladders:\[/.test(seg)) seg = seg.replace(/ladders:\[.*?\],/s, `ladders:[{x:${L},y0:${F},y1:19.2}],`);
  else seg = seg.replace(/doors:\[/, `ladders:[{x:${L},y0:${F},y1:19.2}],\n  doors:[`);
  seg = seg.replace(/(\{t:"chest"[^}]*?)x:([\d.]+),y:([\d.]+)/g, (mm, pre, xs, ys) => {
    const p = remapXY(+xs, +ys, true);
    return p ? pre + `x:${fmt(p[0])},y:${fmt(p[1])}` : mm;
  });
  seg = seg.replace(/x:([\d.]+),y:([\d.]+)/g, (mm, xs, ys) => {
    const p = remapXY(+xs, +ys);
    return p ? `x:${fmt(p[0])},y:${fmt(p[1])}` : mm;
  });
  src = src.slice(0, i0) + seg + (i1 === -1 ? '' : src.slice(i1));
  log.push(`${r.id}: F=${F} ladder x=${L} (${F}..19.2) shelves=${shelves.length} dropped=${dropped.length}`);
}
writeFileSync('src/rooms.js', src);
console.log(log.join('\n'));
