import { ROOMS } from '../src/rooms.js';
const FLY = new Set(['sine_drone','orbit_drone','jammer','scan_turret']);
for (const r of ROOMS) {
  const tops = [];
  for (const [x,y,w,h] of r.solids) tops.push([x, x+w, y+h]);
  for (const [x,y,w] of r.oneway||[]) tops.push([x, x+w, y]);
  const support = (x, y) => { let best = -1e9; for (const [a,b,t] of tops) if (x >= a-0.6 && x <= b+0.6 && t <= y+0.05) best = Math.max(best, t); return best; };
  const report = [];
  for (const it of r.items||[]) { const t = support(it.x, it.y); const d = +(it.y - t).toFixed(2); if (d > 0.05 || d < -0.5) report.push(`item ${it.t}/${it.id} y=${it.y} support=${t} d=${d}`); }
  for (const en of r.enemies||[]) if (!FLY.has(en.t)) { const t = support(en.x, en.y); const d = +(en.y - t).toFixed(2); if (d > 0.05 || d < -0.5) report.push(`enemy ${en.t} y=${en.y} support=${t} d=${d}`); }
  if (r.boss) { const t = support(r.boss.x, r.boss.y); const d = +(r.boss.y - t).toFixed(2); if (d > 0.05 || d < -0.5) report.push(`boss ${r.boss.id} y=${r.boss.y} support=${t} d=${d}`); }
  for (const sv of r.items||[]) if (sv.t==='save'||sv.t==='shop') { const t = support(sv.x, sv.y); const d = +(sv.y - t).toFixed(2); if (d > 0.05 || d < -0.5) report.push(`svc ${sv.t} y=${sv.y} support=${t} d=${d}`); }
  if (report.length) { console.log(r.id); for (const x of report) console.log('   ', x); }
}
console.log('audit done');
