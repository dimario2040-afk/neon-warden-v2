// rechain.mjs — пересборка вертикальных цепей под норматив head-clearance (сплошные полки):
// шаг <=2.2, ширина 4, 3-колонная спираль (та же колонна каждые 3 полки => низ верхней полки >= T+5.6 > apex+head T+4.8),
// верхняя полка = колонка люка (at±2), top 19.2. Предметы/враги со старых полок пересаживаются.
import { readFileSync, writeFileSync } from 'fs';
import { ROOMS } from '../src/rooms.js';
let src = readFileSync('src/rooms.js', 'utf-8');
const fmt = (v) => { const r = Math.round(v * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); };
const report = [];
for (const r of ROOMS) {
  const dn = (r.doors || []).find(d => d.s === 'N');
  if (!dn) continue;
  // пол комнаты
  let F = 0;
  for (const [x, y, w, h] of r.solids) if (h >= 1.5 && y + h <= 12.5) F = Math.max(F, y + h);
  // старые полки цепи: thin с top > F+2.0
  const old = r.solids.filter(s => s[3] <= 0.7 && s[1] + s[3] > F + 2.0);
  if (!old.length) continue;
  // новые: спираль
  const topT = 19.2;
  const first = F + 2.7;
  const n = Math.max(3, Math.round((topT - first) / 2.1) + 1);
  const tops = []; for (let i = 0; i < n; i++) tops.push(Math.round((first + (topT - first) * i / (n - 1)) * 10) / 10);
  const at = dn.at;
  let C = [at - 2 - 16, at - 2 - 8, at - 2];
  if (C[0] < 0.5) C = [at - 2, at + 6, at + 14];
  if (C[2] + 4 > r.w - 0.5) C = [at - 2 - 16, at - 2 - 8, at - 2];
  const ctop = at - 2;
  let order;
  if (C[2] === ctop) order = [C[0], C[1], C[2]];
  else if (C[1] === ctop) order = [C[2], C[0], C[1]];
  else order = [C[1], C[2], C[0]];
  const shelves = tops.map((t, i) => [order[i % 3], t - 0.6, 4, 0.6]);
  // пересадка предметов/врагов со старых полок
  const remap = (o) => {
    const sup = old.find(s => o.x >= s[0] - .5 && o.x <= s[0] + s[2] + .5 && Math.abs(o.y - (s[1] + s[3])) < 0.05);
    if (!sup) return false;
    let best = null, bd = 1e9;
    for (const sh of shelves) { const d = Math.abs(sh[0] + 2 - o.x) + Math.abs(sh[1] + 0.6 - o.y) * 0.5; if (d < bd) { bd = d; best = sh; } }
    o.x = Math.min(best[0] + 3.4, Math.max(best[0] + 0.6, o.x)); o.y = best[1] + best[3];
    return true;
  };
  for (const it of r.items || []) remap(it);
  for (const en of r.enemies || []) if (!['sine_drone','orbit_drone','jammer','scan_turret'].includes(en.t)) remap(en);
  // запись: заменяем блок solids комнаты: убираем old, добавляем shelves
  const i = src.indexOf(`id:"${r.id}"`); const j = src.indexOf('R({', i + 10);
  let seg = src.slice(i, j === -1 ? src.length : j);
  for (const o of old) {
    const pat = `[${fmt(o[0])},${fmt(o[1])},${fmt(o[2])},${fmt(o[3])}]`;
    const pat2 = `[${o[0]},${o[1]},${o[2]},${o[3]}]`;
    if (seg.includes(pat)) seg = seg.replace(pat + ',', '');
    else if (seg.includes(pat2)) seg = seg.replace(pat2 + ',', '');
    else report.push(`${r.id}: miss old ${pat}`);
  }
  // вставка новых перед закрывающей ]] solids
  const m = seg.match(/solids:\[(.*)\],\n/s);
  if (m) {
    const add = shelves.map(sh => `[${fmt(sh[0])},${fmt(sh[1])},${fmt(sh[2])},${fmt(sh[3])}]`).join(',');
    seg = seg.replace(/solids:\[(.*)\],\n/s, (mm, inner) => `solids:[${inner},${add}],\n`);
  }
  // items/enemies обновлённые координаты
  for (const it of r.items || []) {
    // перезапись y/x конкретного item по id/типу
  }
  src = src.slice(0, i) + seg + src.slice(j === -1 ? src.length : j);
  report.push(`${r.id}: ${old.length} old -> ${shelves.length} new (cols ${order.map(c => c.toFixed(0)).join('/')}, tops ${tops[0]}..${tops[n - 1]})`);
}
writeFileSync('src/rooms.js', src);
console.log(report.join('\n'));
