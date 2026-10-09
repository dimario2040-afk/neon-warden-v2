// phys_check.mjs — аналитическая проверка платформинга: в каждой комнате все двери и предметы
// связаны маршрутами, реализуемыми движениями игрока на тире способностей первого визита.
// Правила движения (из feel-констант main.js): jump vy=11.8,g=24 → h≈2.9 (берём 2.6 с запасом);
// servo (2-й прыжок) → до 4.6; разбег/прыжок горизонталь ≤5.0 (gap между краями), с dash ≤9.5;
// вниз/по прямой ≤7.5; лестницы и chimneys (wall) дают вертикаль; movers/phase-платформы соединяют концы пути;
// pogo-pin: сесть сверху (drop) и отскочить до +3.2 к узлам рядом.
import { ROOMS, ROOM_BY_ID } from "../src/rooms.js";
import { bfsProgression } from "../src/worldgraph.js";

const JUMP_DY = 2.8, SERVO_DY = 4.6, GAP = 5.0, GAP_SERVO = 6.5, GAP_DASH = 9.5, GAP_FLAT = 7.5, POGO_UP = 3.2;

function tierOf(setKeyStr) {
  const ab = (setKeyStr || "").split("|")[0] || "";
  return { servo: ab.includes("servo"), wall: ab.includes("wall"), hack2: ab.includes("hack2"), phase: ab.includes("phase"), dash: true };
}
let RIDES = [];
function nodes(room) {
  RIDES = [];
  const N = [];
  const add = (x0, x1, y, kind) => N.push({ x0, x1, y, kind });
  for (const [x, y, w, h] of room.solids) add(x, x + w, y + h, "solid");
  for (const [x, y, w] of room.oneway || []) add(x, x + w, y, "oneway");
  for (const m of room.movers || []) {
    if (m.t === "phase") { add(m.path[0][0], m.path[0][0] + m.w, m.path[0][1], "mover"); } // фазовая платформа статична на path[0]
    else { const i0 = N.length; add(m.path[0][0], m.path[0][0] + m.w, m.path[0][1], "mover"); const i1 = N.length; add(m.path[1][0], m.path[1][0] + m.w, m.path[1][1], "mover"); RIDES.push([i0, i1]); }
  }
  for (const l of room.ladders || []) { add(l.x - 0.6, l.x + 0.6, l.y0, "ladB"); add(l.x - 0.6, l.x + 0.6, l.y1, "ladT"); N[N.length - 2].lad = l; N[N.length - 1].lad = l; }
  for (const d of room.doors) {
    if (d.s === "E") add(room.w - 1.2, room.w - 0.2, d.at, "door");
    else if (d.s === "W") add(0.2, 1.2, d.at, "door");
    else if (d.s === "N") add(d.at - 1.2, d.at + 1.2, room.h - 1.0, "doorN");
    else add(d.at - 1.2, d.at + 1.2, holeFloor(room, d.at), "doorS");
  }
  for (const p of room.pogopins || []) add(p.x - 0.5, p.x + 0.5, p.y + 0.5, "pin");
  return N;
}
function holeFloor(room, at) { // пол рядом с дыркой S-двери
  let f = 0;
  for (const [x, y, w, h] of room.solids) { if (y + h <= 1.5 || (y < 8 && h >= 1.5)) { if (x <= at - 1.0 || x + w >= at + 1.0) if (Math.min(Math.abs(x - at), Math.abs(x + w - at)) < 5) f = Math.max(f, y + h); } }
  return f;
}
const gapBetween = (a, b) => Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1));
const xOverlap = (a, b, pad = 0) => Math.min(a.x1, b.x1 + pad) - Math.max(a.x0, b.x0 - pad) > 0.01;

function edges(room, N, t) {
  const E = [];
  const link = (i, j) => { if (i !== j) E.push([i, j]); };
  for (const [i, j] of RIDES) link(i, j); // езда на мувере между концами пути
  for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) {
    const a = N[i], b = N[j];
    const gap = gapBetween(a, b);
    const up = b.y > a.y ? [a, b, i, j] : [b, a, j, i];
    const [lo, hi, li, hiI] = up;
    const dy = hi.y - lo.y;
    // лестница
    if (a.lad && a.lad === b.lad && a.kind !== b.kind) { link(i, j); continue; }
    // chimney (wall-jump шахта)
    if (t.wall && room.chimneys) for (const c of room.chimneys) {
      const inC = (n) => n.x0 >= c.x0 - 0.8 && n.x1 <= c.x1 + 0.8 && n.y >= c.y0 - 0.5 && n.y <= c.y1 + 0.5;
      if (inC(a) && inC(b) && gap < 6) { link(i, j); }
    }
    // вертикальный прыжок вверх
    // вертикальный прыжок/клаimb сквозь люк: цель — дыра в потолке; старт — полка шире зоны ИЛИ верх лестницы в колонне люка
    if (b.kind === "doorN" && dy > 0 && dy <= 2.6 && (Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) >= 0.5) { link(li, hiI); continue; }
    const sideArc = gap >= 0.45 || (b.x0 - a.x0 >= 1.2) || (a.x1 - b.x1 >= 1.2) ; // сплошные полки: только дуга сбоку
    // LAUNCH-WINDOW: если B нависает над частью A, нужна площадка разбега >=2.0u вне проекции B
    // (иначе после «жёсткого мира» запрыгнуть некуда: bonk в низ B или выталкивание сбоку)
    const launchWin = (a, b) => {
      const freeL = Math.min(b.x0 - 0.34, a.x1) - a.x0, freeR = a.x1 - Math.max(b.x1 + 0.34, a.x0);
      const wL = Math.max(freeL, 0), wR = Math.max(freeR, 0);
      // траектория головы базового хопа с corner-correction (apex ~1.95 + рост 1.9): нависания ниже a.top+3.9 вычитают окно
      const segs = wL >= wR ? [[a.x0, Math.min(b.x0 - 0.34, a.x1)]] : [[Math.max(b.x1 + 0.34, a.x0), a.x1]];
      let best = 0;
      for (let [sa, sb] of segs) {
        if (sb - sa <= 0) continue;
        let cur = [[sa, sb]];
        for (const [ox, oy, ow, oh] of room.solids) {
          if (oh > 0.7) continue;
          const ub = oy;
          if (!(ub >= a.y + 0.3 && ub <= a.y + 3.9)) continue;
          const nx = [];
          for (const [ca, cb] of cur) {
            if (ox + ow <= ca + 0.01 || ox >= cb - 0.01) { nx.push([ca, cb]); continue; }
            if (ox > ca) nx.push([ca, ox]);
            if (ox + ow < cb) nx.push([ox + ow, cb]);
          }
          cur = nx;
        }
        for (const [ca, cb] of cur) best = Math.max(best, cb - ca);
      }
      return best;
    };
    if (dy > 0.01) {
      const overlapEdge = gap < 0.45;
      const winOK = !overlapEdge || (launchWin(a, b) >= 1.2 && dy <= (t.servo ? 4.3 : 2.75));
      if (sideArc && winOK && dy <= JUMP_DY && gap <= GAP) link(li, hiI);
      else if (sideArc && winOK && t.servo && dy <= SERVO_DY && gap <= GAP_SERVO) link(li, hiI);
      else if (sideArc && winOK && t.servo && t.dash && dy <= SERVO_DY && gap <= GAP_DASH) link(li, hiI);
      else if (sideArc && winOK && dy <= JUMP_DY && t.dash && gap <= GAP_DASH) link(li, hiI);
    } else {
      // вниз / по прямой
      if (gap <= GAP_FLAT) link(i, j);
      else if (t.dash && gap <= GAP_DASH && dy > -0.6) link(i, j);
    }
    // N-дверь (люк в потолке): вверх — прыжок сквозь (эффект. dy до h-1), вниз — падение
    if (b.kind === "doorN" && dy > 0) {
      const eff = dy; // node y уже h-1
      if (xOverlap(a, b, 1.0) && ((eff <= JUMP_DY) || (t.servo && eff <= SERVO_DY))) link(li, hiI);
    }
    if (a.kind === "doorN" && xOverlap(a, b, 1.5) && a.y > b.y) link(i, j); // упасть обратно в комнату
    // S-дверь (дырка в полу): вниз — падение; вверх — выход на край пола (gap 0)
    if (a.kind === "doorS" && xOverlap(a, b, 1.5) && b.y > a.y - 0.5 && b.y - a.y <= JUMP_DY && gap <= 1.6) link(i, j);
    if (b.kind === "doorS" && xOverlap(a, b, 1.5) && a.y > b.y - 0.5 && a.y - b.y <= JUMP_DY && gap <= 1.6) link(i, j);
    if (b.kind === "doorS" && xOverlap(a, b, 1.0) && a.y > b.y) link(i, j); // прыгнуть в дырку сверху
    if (a.kind === "doorS" && xOverlap(a, b, 1.0) && b.y > a.y) link(i, j);
    // pogo-pin
    if (a.kind === "pin" && b.kind !== "pin") {
      const dy2 = b.y - a.y, g2 = gapBetween(a, b);
      if (dy2 > 0 && dy2 <= POGO_UP + (t.servo ? 2.0 : 0) && g2 <= 4.5) link(i, j); // отскок вверх
      if (dy2 < 0 && dy2 > -9 && g2 <= 3.5) link(i, j);                            // сесть сверху
    }
    if (b.kind === "pin" && a.kind !== "pin") {
      const dy2 = a.y - b.y, g2 = gapBetween(a, b);
      if (dy2 > 0 && dy2 <= POGO_UP + (t.servo ? 2.0 : 0) && g2 <= 4.5) link(i, j);
      if (dy2 < 0 && dy2 > -9 && g2 <= 3.5) link(i, j);
    }
  }
  // movers: езда между концами пути
  for (const m of room.movers || []) {
    const idx = [];
    N.forEach((n, k) => { if (n.kind === "mover") idx.push(k); });
  }
  return E;
}
function connected(room, N, E, preds) {
  // preds: список групп индексов, которые должны быть в одной компоненте
  const adj = N.map(() => []);
  for (const [i, j] of E) { adj[i].push(j); adj[j].push(i); }
  const comp = new Array(N.length).fill(-1);
  let c = 0;
  for (let s = 0; s < N.length; s++) if (comp[s] === -1) {
    const st = [s]; comp[s] = c;
    while (st.length) { const v = st.pop(); for (const u of adj[v]) if (comp[u] === -1) { comp[u] = c; st.push(u); } }
    c++;
  }
  return comp;
}
let fail = 0;
const { reach } = bfsProgression();
for (const room of ROOMS) {
  const t = tierOf(reach.get(room.id));
  const N = nodes(room), E = edges(room, N, t);
  const comp = connected(room, N, E, t);
  const doorIdx = N.map((n, i) => [n, i]).filter(([n]) => n.kind.startsWith("door"));
  const probs = [];
  // все двери связаны
  const base = doorIdx[0] ? comp[doorIdx[0][1]] : -1;
  for (const [n, i] of doorIdx) if (comp[i] !== base) probs.push(`door ${n.kind}@${n.x0.toFixed(0)},${n.y.toFixed(0)} isolated`);
  // предметы связаны с дверьми
  const itemPts = [];
  for (const it of room.items || []) itemPts.push([it.t, it.x, it.y]);
  for (const cr of room.cracks || []) itemPts.push(["crack", cr.x, cr.y]);
  for (const [kind, x, y] of itemPts) {
    const near = N.findIndex(n => Math.min(Math.abs(n.x0 - x), Math.abs(n.x1 - x), (x >= n.x0 && x <= n.x1 ? 0 : 9)) < 1.6 && Math.abs(n.y - y) <= 3.0 && !n.kind.startsWith("door"));
    const onDoor = N.findIndex(n => n.kind.startsWith("door") && Math.abs(n.x0 - x) < 2 && Math.abs(n.y - y) < 3);
    if (near === -1 && onDoor === -1) { probs.push(`item ${kind}@${x},${y} has no platform node`); continue; }
    const ci = near !== -1 ? comp[near] : comp[onDoor];
    if (ci !== base) probs.push(`item ${kind}@${x},${y} unreachable`);
  }
  // босс-арена: босс и вход связаны
  if (room.boss) {
    const bi = N.findIndex(n => !n.kind.startsWith("door") && Math.abs(n.y - room.boss.y) <= 2.6 && n.x0 - 1 <= room.boss.x && room.boss.x <= n.x1 + 1);
    if (bi === -1 || comp[bi] !== base) probs.push(`boss arena unreachable from doors`);
  }
  // ПРАВИЛО РОСТА: над каждой площадкой, где игрок стоит (top T), свободный от нависаний
  // интервал >=1.2u (нависание = solid с низом < T+2.1 и верхом > T); коридоры дверей E/W тоже.
  {
    const tops = [];
    for (const [x, y, w, h] of room.solids) tops.push([x, x + w, y + h]);
    for (const o of room.oneway || []) tops.push([o[0], o[0] + o[2], o[1]]);
    const overhangs = (T) => room.solids.filter(([x, y, w, h]) => y + h > T + 0.05 && y >= T + 0.3 && y < T + 2.1).map(([x, y, w]) => [x, x + w]);
    const freeWidth = (a, b, T) => {
      let segs = [[a, b]];
      for (const [oa, ob] of overhangs(T)) {
        const nxt = [];
        for (const [sa, sb] of segs) {
          if (ob <= sa + 0.01 || oa >= sb - 0.01) { nxt.push([sa, sb]); continue; }
          if (oa > sa) nxt.push([sa, oa]);
          if (ob < sb) nxt.push([ob, sb]);
        }
        segs = nxt;
      }
      return segs.reduce((m, s2) => Math.max(m, s2[1] - s2[0]), 0);
    };
    for (const [a, b, T] of tops) {
      if (b - a < 1.4) continue; // узкие кромки (трубы/бортики) — не площадки для стойки
      const fw = freeWidth(a, b, T);
      if (fw < 1.2) probs.push(`no standing room: top ${T} [${a}..${b}] free ${fw.toFixed(2)}`);
    }
    for (const d of room.doors) {
      if (d.s === "E" || d.s === "W") {
        const a = d.s === "E" ? room.w - 1.2 : 0.2, b = d.s === "E" ? room.w - 0.2 : 1.2;
        if (freeWidth(a, b, d.at) < 1.0) probs.push(`door ${d.s}@${d.at} corridor blocked by overhang`);
      }
    }
  }
  // жёсткий мир: полка над проходной дорожкой/дверным коридором должна давать голове 2.05+
  const thickTops = [];
  for (const [x, y, w, h] of room.solids) if (h >= 1.5) thickTops.push([x, x + w, y + h]);

  for (const d of room.doors) if (d.s === "S") { // над дыркой S-люка голова тоже должна помещаться
    const F = holeFloor(room, d.at);
    for (const [x, y, w, h] of room.solids) {
      if (h > 0.7) continue;
      const ov = Math.min(x + w, d.at + 1.2) - Math.max(x, d.at - 1.2);
      if (ov > 0.3 && y - F < 2.05 && y + h > F + 0.3) probs.push(`shelf hangs over S-hole ${d.at} (clearance ${(y - F).toFixed(2)})`);
    }
  }

  if (probs.length) { fail++; console.log(` FAIL ${room.id} [tier ${Object.keys(t).filter(k => t[k]).join("+")}]`); probs.forEach(p => console.log("        - " + p)); }
  else console.log(`  OK  ${room.id.padEnd(4)} doors+items connected (tier: ${Object.keys(t).filter(k => t[k] && k !== "dash").join("+") || "base"})`);
}
console.log(fail === 0 ? "\nPHYS: PASS" : `\nPHYS: ${fail} rooms with problems`);
process.exit(fail === 0 ? 0 : 1);
