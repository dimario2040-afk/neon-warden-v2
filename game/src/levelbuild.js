// levelbuild.js — компилятор комнат (rooms.js) в рантайм: коллайдеры, меши, двери, хазарды, муверы.
// Новая комната = запись в rooms.js: ядро не правится.
import * as THREE from "three";
import { ROOMS, ROOM_BY_ID, CELL_W, CELL_H, ROOM_W, ROOM_H } from "./rooms.js";
import { BIOMES } from "./biomes.js";
import { box, registerRoomChunk, registerNeonLight, mats } from "./world.js";

const UNIT = new THREE.BoxGeometry(1, 1, 1);
const UNIT_NI = UNIT.toNonIndexed();
const _bp = UNIT_NI.getAttribute("position").array, _bn = UNIT_NI.getAttribute("normal").array, _bu = UNIT_NI.getAttribute("uv").array;
// mergeBoxes: конкатенация unit-box'ов (translate+scale) → один меш/материал на комнату
function mergeBoxes(entries, mat) {
  const n = entries.length * _bp.length;
  const pos = new Float32Array(n), nor = new Float32Array(n), uv = new Float32Array(entries.length * _bu.length);
  let p = 0, u = 0;
  for (const [cx, cy, cz, sx, sy, sz] of entries) {
    for (let i = 0; i < _bp.length; i += 3) {
      pos[p] = _bp[i] * sx + cx; pos[p + 1] = _bp[i + 1] * sy + cy; pos[p + 2] = _bp[i + 2] * sz + cz;
      nor[p] = _bn[i]; nor[p + 1] = _bn[i + 1]; nor[p + 2] = _bn[i + 2];
      p += 3;
    }
    uv.set(_bu, u); u += _bu.length;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return new THREE.Mesh(geo, mat);
}
function bx(parent, x, y, z, sx, sy, sz, m) { const q = new THREE.Mesh(UNIT, m); q.scale.set(sx, sy, sz); q.position.set(x, y, z); parent.add(q); return q; }
const biomesCache = new Map();
function biomeMats(biomeId) {
  if (biomesCache.has(biomeId)) return biomesCache.get(biomeId);
  const B = BIOMES[biomeId];
  const o = { plat: B.platMat(), edges: B.edgeMats(), wall: B.wallMat() };
  biomesCache.set(biomeId, o);
  return o;
}
export function roomOrigin(room) { return { x: room.map[0] * CELL_W, y: -room.map[1] * CELL_H }; }
function holeFloor(room, at) {
  let f = 0;
  for (const [x, y, w, h] of room.solids) { if (h >= 1.5 && y + h <= 12.5) { if (x <= at - 1.0 || x + w >= at + 1.0) if (Math.min(Math.abs(x - at), Math.abs(x + w - at)) < 5) f = Math.max(f, y + h); } }
  return f;
}
// Периметр комнаты с проёмами под двери
function perimeter(room) {
  const out = [];
  const doors = room.doors;
  const w = room.w, h = room.h, T = 2;
  const ewOpen = doors.filter(d => d.s === "E").map(d => [d.at, d.at + 2.6]);
  const wwOpen = doors.filter(d => d.s === "W").map(d => [d.at, d.at + 2.6]);
  const nOpen = doors.filter(d => d.s === "N").map(d => [d.at - 1.2, d.at + 1.2]);
  const sOpen = doors.filter(d => d.s === "S").map(d => [d.at - 1.2, d.at + 1.2]);
  const seg = (openings, from, to) => { // отрезки [from,to] минус проёмы
    const ops = openings.slice().sort((a, b) => a[0] - b[0]);
    let cur = from; const res = [];
    for (const [a, b] of ops) { if (a > cur) res.push([cur, a]); cur = Math.max(cur, b); }
    if (cur < to) res.push([cur, to]);
    return res;
  };
  // ПОЛ комнаты задаётся данными комнаты (авторские плиты с вырезами под S-люки).
  // Периметральный пол НЕ генерируется: иначе под приподнятыми полами (стоки/сеть) возникал
  // «подпол»-карман с неверным holeFloor и скрытым дном под кислотой.
  for (const [a, b] of seg(nOpen, 0, w)) out.push({ x: a, y: h, w: b - a, h: T, part: "ceil" });
  for (const [a, b] of seg(wwOpen, 0, h)) out.push({ x: -T, y: a, w: T, h: b - a, part: "wallL" });
  for (const [a, b] of seg(ewOpen, 0, h)) out.push({ x: w, y: a, w: T, h: b - a, part: "wallR" });
  return out;
}
export function doorZone(room, d) {
  const F = d.s === "S" ? holeFloor(room, d.at) : 0;
  if (d.s === "E") return { x0: room.w - 1.0, x1: room.w + 0.8, y0: d.at, y1: d.at + 2.4 };
  if (d.s === "W") return { x0: -0.8, x1: 1.0, y0: d.at, y1: d.at + 2.4 };
  if (d.s === "N") return { x0: d.at - 1.2, x1: d.at + 1.2, y0: room.h - 0.35, y1: room.h + 0.8 }; // зона только внутри люка: верхние полки цепей не должны её перекрывать
  // S-зона = ВЕСЬ проём в полу (иначе падение у кромки широкой ямы мимо зоны = смерть вместо портала)
  let xL = d.at - 1.2, xR = d.at + 1.2;
  const floors = room.solids.filter(([x, y, w, h]) => h >= 1.5 && Math.abs(y + h - F) < 0.05);
  const left = floors.filter(([x, y, w, h]) => x + w <= d.at + 0.6).map(([x, y, w, h]) => x + w).sort((a, b) => b - a)[0];
  const right = floors.filter(([x, y, w, h]) => x >= d.at - 0.6).map(([x, y, w, h]) => x).sort((a, b) => a - b)[0];
  if (left !== undefined && d.at - left <= 4) xL = left;
  if (right !== undefined && right - d.at <= 4) xR = right;
  return { x0: xL, x1: xR, y0: F - 1.4, y1: F + 0.6 };
}
function textSprite(text, color = "#8BE9FF", scale = 3.2) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 96;
  const x = c.getContext("2d");
  x.font = "700 40px ui-monospace, monospace"; x.fillStyle = color; x.textAlign = "center"; x.textBaseline = "middle";
  x.shadowColor = color; x.shadowBlur = 18; x.fillText(text, 256, 52);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: .85, depthWrite: false });
  const s = new THREE.Sprite(m); s.scale.set(scale, scale * 96 / 512, 1); return s;
}

export const RT = new Map(); // roomId -> runtime
export function buildAllRooms() {
  for (const room of ROOMS) {
    const o = roomOrigin(room);
    const B = BIOMES[room.biome], M = biomeMats(room.biome);
    const g = new THREE.Group();
    const rt = {
      id: room.id, room, biome: room.biome, name: room.name, origin: o, w: room.w, h: room.h,
      solids: [], oneways: [], hazards: [], movers: [], lifts: [], ladders: [], conveyors: [], winds: [],
      pins: [], cracks: [], secdoors: [], barriers: [], doors: [], items: [], enemies: [], boss: null,
      group: g, animated: [], enter: { x: o.x + (room.enter?.x ?? 2), y: o.y + (room.enter?.y ?? 0) }, safe: !!room.safe, secret: !!room.secret,
    };
    const addSolid = (x, y, w, h, kind, mesh) => rt.solids.push({ x0: o.x + x, y0: o.y + y, x1: o.x + x + w, y1: o.y + y + h, kind, mesh });
    // ── геометрия автора + периметр (merge в 4 меша на комнату: draw-calls) ──
    const entPlat = [], entWall = [], entE0 = [], entE1 = [];
    room.solids.forEach(([x, y, w, h], i) => {
      entPlat.push([o.x + x + w / 2, o.y + y + h / 2, 0, w, h, 3]);
      (i % 2 ? entE1 : entE0).push([o.x + x + w / 2, o.y + y + h + 0.03, -1.55, w, 0.06, 0.06]);
      // тонкие платформы = one-way (как в v1): сквозь них можно прыгать снизу и проходить сбоку под ними
      addSolid(x, y, w, h, h <= 0.7 ? "thin" : "plat", null);
    });
    for (const p of perimeter(room)) {
      entWall.push([o.x + p.x + p.w / 2, o.y + p.y + p.h / 2, -0.4, p.w, p.h, 3]);
      addSolid(p.x, p.y, p.w, p.h, p.part, null);
    }
    for (const [entries, mat] of [[entPlat, M.plat], [entWall, M.wall], [entE0, M.edges[0]], [entE1, M.edges[1]]]) {
      if (!entries.length) continue;
      const mesh = mergeBoxes(entries, mat);
      if (mesh) g.add(mesh);
    }
    for (const [x, y, w] of room.oneway || []) {
      const m = bx(g, o.x + x + w / 2, o.y + y - 0.12, 0, w, 0.24, 2.4, M.plat);
      const e = bx(g, o.x + x + w / 2, o.y + y + 0.02, -1.25, w, 0.05, 0.05, M.edges[0]);
      rt.oneways.push({ x0: o.x + x, y: o.y + y, x1: o.x + x + w, mesh: m, edge: e });
    }
    // ── двери: рама + светящий кант ──
    for (const d of room.doors) {
      const z = doorZone(room, d);
      const cx = o.x + (z.x0 + z.x1) / 2, cy = o.y + (z.y0 + z.y1) / 2;
      const frame = new THREE.Group();
      const gm = M.edges[d.gate ? 1 : 0];
      if (d.s === "E" || d.s === "W") {
        bx(frame, cx, cy + 1.3, -0.6, 0.5, 0.3, 1.2, gm);
        bx(frame, cx, cy - 0.15, -0.6, 0.5, 2.6, 0.16, M.wall);
      } else {
        bx(frame, cx, cy + (d.s === "N" ? 0.9 : -0.9), -0.6, 2.8, 0.3, 1.2, gm);
      }
      g.add(frame);
      rt.doors.push({ side: d.s, at: d.at, to: d.to, gate: d.gate || null, lock: !!d.lock, zone: { x0: o.x + z.x0, x1: o.x + z.x1, y0: o.y + z.y0, y1: o.y + z.y1 }, mesh: frame });
    }
    // ── хазарды ──
    for (const hz of room.hazards || []) {
      const rec = { ...hz, x0: o.x + hz.x, y0: o.y + hz.y, x1: o.x + hz.x + hz.w, y1: o.y + hz.y + hz.h, t0: 0 };
      if (hz.t === "acid") {
        const AC = { stoki: 0x1FBF4A, prom: 0xFF8C1A, set: 0xFF2D78, neon: 0x00F5FF, pusto: 0xFFB040, mega: 0x7A4CFF };
        const m = new THREE.MeshBasicMaterial({ color: AC[room.biome] || 0x39FF14, transparent: true, opacity: .38, depthWrite: false });
        rec.mesh = bx(g, o.x + hz.x + hz.w / 2, o.y + hz.y + hz.h / 2, 0.4, hz.w, hz.h, 2.2, m);
        const wire = bx(g, o.x + hz.x + hz.w / 2, o.y + hz.y + hz.h, 0.42, hz.w, 0.05, 2.24, new THREE.MeshBasicMaterial({ color: AC[room.biome] || 0x39FF14, transparent: true, opacity: .9 }));
        wire.material.toneMapped = false;
        rt.animated.push({ kind: "acid", mesh: rec.mesh, y0: o.y + hz.y + hz.h / 2, ph: Math.random() * 6 });
      } else if (hz.t === "spikes") {
        rec.mesh = bx(g, o.x + hz.x + hz.w / 2, o.y + hz.y + hz.h / 2, 0, hz.w, hz.h, 2, mats.hazard);
      } else if (hz.t === "crusher") {
        rec.mesh = bx(g, o.x + hz.x + hz.w / 2, o.y + hz.y + hz.h / 2, 0, hz.w, hz.h, 2.4, M.plat);
        bx(g, o.x + hz.x + hz.w / 2, o.y + hz.y - 0.15, -1.3, hz.w, 0.12, 0.12, M.edges[1]);
        rt.animated.push({ kind: "crusher", mesh: rec.mesh, rec, ph: hz.phase || 0 });
      }
      rt.hazards.push(rec);
    }
    // ── муверы / фазовые платформы ──
    for (const mv of room.movers || []) {
      const mat = mv.t === "phase" ? new THREE.MeshStandardMaterial({ color: 0x1A0A2E, emissive: 0xFF2D78, emissiveIntensity: 2.6, transparent: true, opacity: .8 }) : M.plat;
      const mesh = bx(g, o.x + mv.path[0][0] + mv.w / 2, o.y + mv.path[0][1] - 0.15, 0, mv.w, 0.3, 2.6, mat);
      mesh.material = mat.clone ? mat : mat;
      const rec = { ...mv, mesh, rect: null, solidNow: true, cx: undefined, cy: undefined, dx: 0, dy: 0, tT: mv.phase || 0 };
      rt.movers.push(rec); rt.animated.push({ kind: "mover", rec });
    }
    // ── лифты-транспорты ──
    for (const lf of room.lifts || []) {
      const pad = bx(g, o.x + lf.x + lf.w / 2, o.y + lf.y + 0.1, 0, lf.w, 0.2, 2.4, M.edges[1]);
      const zone = { x0: o.x + lf.x, x1: o.x + lf.x + lf.w, y0: o.y + lf.y, y1: o.y + lf.y + (lf.h || 2.6) };
      rt.lifts.push({ ...lf, zone, mesh: pad });
      rt.animated.push({ kind: "liftpad", mesh: pad, ph: Math.random() * 6 });
    }
    // ── лестницы ──
    for (const l of room.ladders || []) {
      const hgt = l.y1 - l.y0;
      bx(g, o.x + l.x - 0.16, o.y + (l.y0 + l.y1) / 2, 0.15, 0.05, hgt, 0.05, M.edges[0]);
      bx(g, o.x + l.x + 0.16, o.y + (l.y0 + l.y1) / 2, 0.15, 0.05, hgt, 0.05, M.edges[0]);
      rt.ladders.push({ x: o.x + l.x, y0: o.y + l.y0, y1: o.y + l.y1 });
    }
    // ── конвейеры / ветер ──
    for (const c of room.conveyors || []) {
      const m = bx(g, o.x + c.x + c.w / 2, o.y + c.y + 0.06, -1.5, c.w, 0.1, 0.1, M.edges[c.dir > 0 ? 0 : 1]);
      rt.conveyors.push({ ...c, x0: o.x + c.x, x1: o.x + c.x + c.w, y: o.y + c.y, mesh: m });
      rt.animated.push({ kind: "conveyor", mesh: m, dir: c.dir });
    }
    for (const w of room.winds || []) rt.winds.push({ ...w, x0: o.x + w.x, y0: o.y + w.y, x1: o.x + w.x + w.w, y1: o.y + w.y + w.h });
    // ── пого-пины ──
    for (const p of room.pogopins || []) {
      const grp = new THREE.Group();
      bx(grp, 0, -0.35, 0, 0.22, 0.7, 0.22, M.wall);
      bx(grp, 0, 0.12, 0, 0.9, 0.28, 0.9, M.edges[0]);
      grp.position.set(o.x + p.x, o.y + p.y, 0); g.add(grp);
      rt.pins.push({ x: o.x + p.x, y: o.y + p.y, mesh: grp });
    }
    // ── трещины (секреты) ──
    for (const c of room.cracks || []) {
      const m = bx(g, o.x + c.x + c.w / 2, o.y + c.y + c.h / 2, -0.2, c.w, c.h, 2.6, new THREE.MeshStandardMaterial({ color: 0x2A2A34, roughness: .95, metalness: .05 }));
      rt.cracks.push({ ...c, x0: o.x + c.x, y0: o.y + c.y, x1: o.x + c.x + c.w, y1: o.y + c.y + c.h, mesh: m, dead: false });
    }
    // ── sec-двери (hack2) ──
    for (const sd of room.secdoors || []) {
      const m = bx(g, o.x + sd.x, o.y + sd.y + sd.h / 2, 0, 0.5, sd.h, 2.6, new THREE.MeshStandardMaterial({ color: 0x2A0A0A, emissive: 0xFF164F, emissiveIntensity: 2.2 }));
      rt.secdoors.push({ ...sd, x0: o.x + sd.x - 0.25, y0: o.y + sd.y, x1: o.x + sd.x + 0.25, y1: o.y + sd.y + sd.h, mesh: m, open: false });
    }
    // ── фазовые барьеры (phase) ──
    for (const b of room.barriers || []) {
      const m = bx(g, o.x + b.x + b.w / 2, o.y + b.y + b.h / 2, 0, b.w, b.h, 2.2, new THREE.MeshStandardMaterial({ color: 0x1A0A2E, emissive: 0x7A4CFF, emissiveIntensity: 3.0, transparent: true, opacity: .6 }));
      rt.barriers.push({ x0: o.x + b.x, y0: o.y + b.y, x1: o.x + b.x + b.w, y1: o.y + b.y + b.h, mesh: m });
      rt.animated.push({ kind: "barrier", mesh: m, ph: Math.random() * 6 });
    }
    // ── предметы ──
    for (const it of room.items || []) {
      const rec = { ...it, x: o.x + it.x, y: o.y + it.y, taken: false, mesh: null };
      if (it.t === "save") {
        const grp = new THREE.Group();
        bx(grp, 0, 0.5, 0, 0.5, 1.0, 0.5, M.wall);
        bx(grp, 0, 1.15, 0, 0.7, 0.16, 0.7, M.edges[0]);
        const spr = textSprite("ТЕРМИНАЛ", B.uiAccent, 2.4); spr.position.set(0, 2.1, 0); grp.add(spr);
        grp.position.set(rec.x, rec.y, 0); g.add(grp); rec.mesh = grp;
      } else if (it.t === "shop") {
        const grp = new THREE.Group();
        bx(grp, 0, 0.75, 0, 0.6, 1.5, 0.5, new THREE.MeshStandardMaterial({ color: 0x2A2018, roughness: .6, metalness: .4 }));
        bx(grp, 0, 1.62, 0, 0.42, 0.42, 0.42, new THREE.MeshStandardMaterial({ color: 0x0a0a12, emissive: 0xFFD700, emissiveIntensity: 2.4 }));
        const spr = textSprite("МАГАЗИН", "#FFD700", 2.4); spr.position.set(0, 2.4, 0); grp.add(spr);
        grp.position.set(rec.x, rec.y, 0); g.add(grp); rec.mesh = grp;
      } else if (it.t === "chest") {
        const grp = new THREE.Group();
        bx(grp, 0, 0.3, 0, 1.0, 0.6, 0.7, new THREE.MeshStandardMaterial({ color: 0x2A2200, roughness: .4, metalness: .7 }));
        bx(grp, 0, 0.62, 0, 1.04, 0.1, 0.74, M.edges[1]);
        grp.position.set(rec.x, rec.y, 0); g.add(grp); rec.mesh = grp;
        rt.animated.push({ kind: "chest", mesh: grp, ph: Math.random() * 6, y0: rec.y });
      }
      rt.items.push(rec);
    }
    // ──	props-надписи ──
    for (const pr of room.props || []) {
      const spr = textSprite(pr.s, B.uiAccent, pr.t === "holo" ? 5 : 3.4);
      spr.position.set(o.x + pr.x, o.y + pr.y, -2); g.add(spr);
      if (pr.t === "holo") rt.animated.push({ kind: "holo", mesh: spr, ph: Math.random() * 6 });
    }
    // ── враги и босс (спавны в мировых координатах) ──
    for (const en of room.enemies || []) rt.enemies.push({ t: en.t, x: o.x + en.x, y: o.y + en.y, o: en.o || {}, room: room.id });
    if (room.boss) rt.boss = { id: room.boss.id, x: o.x + room.boss.x, y: o.y + room.boss.y, room: room.id };
    // неон-свет биома в комнате (2 дефа)
    registerNeonLight(new THREE.Color(B.uiAccent).getHex(), 16, o.x + room.w * 0.3, o.y + room.h * 0.45, 34);
    registerNeonLight(new THREE.Color(B.rimColor).getHex(), 12, o.x + room.w * 0.75, o.y + room.h * 0.35, 32);
    registerRoomChunk(room.id, g, rt.animated);
    RT.set(room.id, rt);
  }
  return RT;
}
export function getRT(id) { return RT.get(id); }
