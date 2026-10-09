// debugx.js — debug-режим: F1 телепорт по комнатам · F2 коллизии · F4 граф комнат ·
// F5 состояния врагов · F6 физика игрока · window.__DBG API (tp/give/killall/bfs/fps).
import * as THREE from "three";
import { scene, camera } from "./world.js";
import { ROOMS, ROOM_BY_ID } from "./rooms.js";
import { buildEdges, bfsProgression } from "./worldgraph.js";
import { BIOMES } from "./biomes.js";

let api = null;
const st = { tp: false, col: false, graph: false, labels: false, phys: false };
let colLines = null, graphDiv = null, tpDiv = null, labelPool = [], physDiv = null, tpIdx = 0;

export function dbgInit(a) {
  api = a;
  window.__DBG = {
    tp: (id) => a.tp(id),
    give: (ab) => a.give(ab),
    killall: () => a.killall(),
    killboss: () => a.killboss(),
    clearLocks: () => a.clearLocks(),
    showParallax: () => a.showParallax(),
    bfs: () => a.bfs(),
    edges: () => a.edges(),
    save: () => a.save(),
    fps: () => a.fps(),
    flags: () => ({ ...st }),
    help: () => "F1 tp · F2 colliders · F4 graph · F5 enemy states · F6 physics · __DBG.tp('p6') __DBG.give('wall') __DBG.killall() __DBG.bfs()",
  };
  addEventListener("keydown", e => {
    if (e.code === "F1") { st.tp = !st.tp; ensureTp(); tpDiv.style.display = st.tp ? "block" : "none"; if (st.tp) renderTp(); }
    if (e.code === "F2") { st.col = !st.col; if (!st.col && colLines) { scene.remove(colLines); colLines = null; } }
    if (e.code === "F4") { st.graph = !st.graph; ensureGraph(); graphDiv.style.display = st.graph ? "flex" : "none"; if (st.graph) renderGraph(); }
    if (e.code === "F5") { st.labels = !st.labels; if (!st.labels) for (const l of labelPool) l.el.remove(); labelPool = []; }
    if (e.code === "F6") { st.phys = !st.phys; ensurePhys(); physDiv.style.display = st.phys ? "block" : "none"; }
    if (st.tp && e.code === "ArrowDown") { tpIdx = (tpIdx + 1) % ROOMS.length; renderTp(); }
    if (st.tp && e.code === "ArrowUp") { tpIdx = (tpIdx + ROOMS.length - 1) % ROOMS.length; renderTp(); }
    if (st.tp && e.code === "Enter") { api.tp(ROOMS[tpIdx].id); }
  });
}
function baseDiv(id) {
  let d = document.getElementById(id);
  if (!d) { d = document.createElement("div"); d.id = id; document.body.appendChild(d); }
  return d;
}
function ensureTp() {
  tpDiv = baseDiv("dbgTp");
  tpDiv.style.cssText = "position:fixed;left:12px;top:120px;z-index:40;background:rgba(6,12,20,.92);border:1px solid rgba(0,245,255,.4);border-radius:8px;padding:10px;font:11px ui-monospace,monospace;color:#8BE9FF;max-height:60vh;overflow:auto;display:none;white-space:pre";
}
function renderTp() {
  if (!tpDiv) return;
  tpDiv.textContent = "TELEPORT (↑↓ + Enter)\n" + ROOMS.map((r, i) => (i === tpIdx ? "▶ " : "  ") + r.id.padEnd(5) + " " + r.biome.padEnd(6) + " " + r.name).join("\n");
}
function ensureGraph() {
  graphDiv = baseDiv("dbgGraph");
  graphDiv.style.cssText = "position:fixed;inset:0;z-index:39;background:rgba(4,8,14,.9);display:none;align-items:center;justify-content:center";
}
function renderGraph() {
  const { edges } = buildEdges();
  const res = bfsProgression();
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const r of ROOMS) { minX = Math.min(minX, r.map[0]); maxX = Math.max(maxX, r.map[0]); minY = Math.min(minY, r.map[1]); maxY = Math.max(maxY, r.map[1]); }
  const CW = 84, CH = 46;
  const W = (maxX - minX + 1) * CW + 80, H = (maxY - minY + 1) * CH + 80;
  const pos = (r) => [40 + (r.map[0] - minX) * CW + CW / 2 - 34, 40 + (r.map[1] - minY) * CH + CH / 2 - 16];
  let svg = `<svg width="${W}" height="${H}" style="max-width:92vw;max-height:86vh">`;
  for (const e of edges) {
    const [ax, ay] = pos(ROOM_BY_ID[e.a]), [bx, by] = pos(ROOM_BY_ID[e.b]);
    svg += `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${e.gate ? "#FFD700" : "#4A6070"}" stroke-width="2" ${e.gate || e.lockA || e.lockB ? 'stroke-dasharray="5 4"' : ""}/>`;
    if (e.gate) svg += `<text x="${(ax + bx) / 2 - 14}" y="${(ay + by) / 2 - 4}" fill="#FFD700" font-size="9" font-family="monospace">${e.gate}</text>`;
  }
  for (const r of ROOMS) {
    const [x, y] = pos(r);
    const acc = BIOMES[r.biome].uiAccent;
    const reached = res.reach.has(r.id);
    svg += `<rect x="${x - 32}" y="${y - 15}" width="64" height="30" fill="${reached ? acc + "33" : "#330a12"}" stroke="${acc}" stroke-width="1.4" rx="4"/>`;
    svg += `<text x="${x}" y="${y - 2}" fill="#EAFBFF" font-size="10" text-anchor="middle" font-family="monospace">${r.id}</text>`;
    svg += `<text x="${x}" y="${y + 10}" fill="${acc}" font-size="8" text-anchor="middle" font-family="monospace">${r.biome}${r.boss ? " ☠" : ""}${r.safe ? " ⌂" : ""}</text>`;
  }
  svg += "</svg>";
  graphDiv.innerHTML = svg + `<div style="position:absolute;top:10px;left:14px;font:11px ui-monospace,monospace;color:#8BE9FF">ГРАФ КОМНАТ · золотой пунктир = гейт способности · тёмно-красный = недостижимо · F4 — закрыть</div>`;
}
function ensurePhys() {
  physDiv = baseDiv("dbgPhys");
  physDiv.style.cssText = "position:fixed;right:12px;top:120px;z-index:40;background:rgba(6,12,20,.9);border:1px solid rgba(255,215,0,.4);border-radius:8px;padding:8px;font:11px ui-monospace,monospace;color:#FFE66D;display:none;white-space:pre";
}
export function dbgLines() { return st.col ? "COLLIDERS" : st.graph ? "GRAPH" : st.tp ? "TP" : st.labels ? "AI" : st.phys ? "PHYS" : ""; }
export function dbgUpdate(dt) {
  if (!api) return;
  if (st.col) drawColliders();
  if (st.labels) drawLabels();
  if (st.phys && physDiv) {
    const p = api.save();
    physDiv.textContent = dbgPhysText();
  }
}
let physGetter = null;
export function dbgSetPhysGetter(g) { physGetter = g; }
function dbgPhysText() { return physGetter ? physGetter() : ""; }
function drawColliders() {
  if (colLines) { scene.remove(colLines); colLines.geometry.dispose(); }
  const pts = [];
  const rt = api.getRT();
  const rect = (x0, y0, x1, y1, up = true) => { pts.push(x0, y0, 0.2, x1, y0, 0.2, x1, y0, 0.2, x1, y1, 0.2, x1, y1, 0.2, x0, y1, 0.2, x0, y1, 0.2, x0, y0, 0.2); };
  for (const s of rt.solids) rect(s.x0, s.y0, s.x1, s.y1);
  for (const o of rt.oneways) pts.push(o.x0, o.y, 0.2, o.x1, o.y, 0.2);
  for (const h of rt.hazards) rect(h.x0, h.y0, h.x1, h.y1);
  for (const d of rt.doors) rect(d.zone.x0, d.zone.y0, d.zone.x1, d.zone.y1);
  for (const m of rt.movers) if (m.rect) rect(m.rect.x0, m.rect.y0, m.rect.x1, m.rect.y1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  colLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x39FF14 }));
  scene.add(colLines);
}
function drawLabels() {
  // лейблы врагов: etype + состояние + hp
  const alive = [];
  for (const e of (window.__GAME__?.enemies || [])) if (!e.dead) alive.push(e);
  while (labelPool.length < alive.length) {
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;z-index:41;font:10px ui-monospace,monospace;color:#FFD700;background:rgba(6,12,20,.8);border:1px solid rgba(255,215,0,.4);border-radius:4px;padding:2px 5px;pointer-events:none;white-space:pre";
    document.body.appendChild(el); labelPool.push({ el });
  }
  for (let i = 0; i < labelPool.length; i++) {
    const e = alive[i];
    if (!e) { labelPool[i].el.style.display = "none"; continue; }
    const v = new THREE.Vector3(e.x, e.y + 1.6, 0).project(camera);
    const el = labelPool[i].el;
    el.style.display = "block";
    el.style.left = ((v.x * .5 + .5) * innerWidth) + "px";
    el.style.top = ((-v.y * .5 + .5) * innerHeight) + "px";
    const state = e.bstate || e.st || (e.telegraphT > 0 ? "WINDUP" : e.aggro ? "AGGRO" : e.channel ? "CHANNEL" : e.lock > .1 ? "LOCK" : "PATROL");
    el.textContent = `${e.t} · ${state} · ${Math.max(0, Math.round(e.hp))}/${e.max}`;
  }
}
