// mapui.js — карта метроидвании (Tab): ячейки комнат, туман открытия, иконки, дверные связи.
// Миникарта: текущий район (соседи ±2 клетки). Данные комнат — из rooms.js; открытие — из main.
import { ROOMS, ROOM_BY_ID } from "./rooms.js";
import { BIOMES } from "./biomes.js";
import { buildEdges } from "./worldgraph.js";

const discovered = new Set();
let getters = null;
export function mapuiInit(g) { getters = g; }
export function mapuiDraw() { if (getters) drawMinimap(getters.room(), getters.playerPos(), getters.save()); if (_open) drawMap(getters.room(), getters.save(), getters.goals && getters.goals()); }
let overlay = null, canvas = null, ctx = null;
let _open = false;
export function mapOpen() { return _open; }
export function mapDiscover(rt) { if (rt) discovered.add(rt.id); if (_open) drawMap(getters ? getters.room() : null, getters ? getters.save() : null); }
export function mapLoadVisited(ids) { for (const id of ids) discovered.add(id); }

function ensureOverlay() {
  if (overlay) return;
  overlay = document.createElement("div");
  overlay.id = "mapOverlay";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(4,8,14,.94);z-index:24;display:none;align-items:center;justify-content:center;flex-direction:column";
  canvas = document.createElement("canvas");
  canvas.width = 1000; canvas.height = 620;
  canvas.style.cssText = "max-width:94vw;max-height:68vh;border:1px solid rgba(0,245,255,.25);border-radius:10px;background:rgba(8,14,22,.9)";
  const t = document.createElement("div");
  t.style.cssText = "font:900 14px ui-monospace,monospace;letter-spacing:.22em;color:#8BE9FF;margin-bottom:10px;text-transform:uppercase";
  t.textContent = "КАРТА НЕОН-ГОРОДА // TAB — закрыть";
  const lg = document.createElement("div");
  lg.style.cssText = "font:600 10px ui-monospace,monospace;letter-spacing:.12em;color:#7A8A9A;margin-top:8px";
  lg.textContent = "⌂ терминал · $ магазин · ☠ босс · ◆ сундук · ⇕ шахта · золотой пунктир = гейт (подпись = что нужно)";
  const goals = document.createElement("div");
  goals.id = "mapGoals";
  goals.style.cssText = "font:700 11px ui-monospace,monospace;letter-spacing:.1em;color:#FFE66D;margin-top:10px;text-align:center;line-height:1.7";
  overlay.append(t, canvas, lg, goals);
  document.body.appendChild(overlay);
  ctx = canvas.getContext("2d");
}
export function openMap() { ensureOverlay(); _open = true; overlay.style.display = "flex"; drawMap(getters ? getters.room() : null, getters ? getters.save() : null, getters && getters.goals ? getters.goals() : null); }
export function closeMap() { _open = false; if (overlay) overlay.style.display = "none"; }

const CELL = 46, GAPX = 10, GAPY = 10;
function bounds() {
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const r of ROOMS) { minX = Math.min(minX, r.map[0]); maxX = Math.max(maxX, r.map[0]); minY = Math.min(minY, r.map[1]); maxY = Math.max(maxY, r.map[1]); }
  return { minX, maxX, minY, maxY };
}
function cellXY(r, b) { return { x: 40 + (r.map[0] - b.minX) * (CELL + GAPX), y: 40 + (r.map[1] - b.minY) * (CELL + GAPY) }; }
export function drawMap(currentRoom, saveRef, goals) {
  ensureOverlay(); if (!ctx) return;
  const gEl = document.getElementById("mapGoals");
  if (gEl) gEl.innerHTML = goals && goals.length ? ("ЦЕЛИ // " + goals.join(" · ")) : "ЦЕЛИ // ВСЁ ОТКРЫТО — ФИНАЛ: s5 ТРОН ГЛИТЧ-МАТЕРИ";
  const b = bounds();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0A121C"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const edges = buildEdges().edges;
  // связи
  for (const e of edges) {
    const ra = ROOM_BY_ID[e.a], rb = ROOM_BY_ID[e.b];
    if (!discovered.has(e.a) && !discovered.has(e.b)) continue;
    const pa = cellXY(ra, b), pb = cellXY(rb, b);
    const gated = !!(e.gate || e.lockA || e.lockB);
    ctx.strokeStyle = gated ? "rgba(255,215,0,.5)" : "rgba(120,150,170,.4)";
    ctx.setLineDash(gated ? [4, 3] : []);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(pa.x + CELL / 2, pa.y + CELL / 2); ctx.lineTo(pb.x + CELL / 2, pb.y + CELL / 2); ctx.stroke();
    ctx.setLineDash([]);
    if (e.gate) { ctx.fillStyle = "rgba(255,215,0,.85)"; ctx.font = "700 9px ui-monospace,monospace"; ctx.textAlign = "center"; ctx.fillText(e.gate.toUpperCase(), (pa.x + pb.x) / 2 + CELL / 2, (pa.y + pb.y) / 2 + CELL / 2 - 5); }
    if (e.lockA || e.lockB) { ctx.fillStyle = "rgba(154,168,184,.8)"; ctx.font = "700 9px ui-monospace,monospace"; ctx.textAlign = "center"; ctx.fillText("LOCK", (pa.x + pb.x) / 2 + CELL / 2, (pa.y + pb.y) / 2 + CELL / 2 - 5); }
  }
  // комнаты
  for (const r of ROOMS) {
    const p = cellXY(r, b);
    const disc = discovered.has(r.id);
    const B = BIOMES[r.biome];
    if (!disc) { ctx.strokeStyle = "rgba(70,90,110,.25)"; ctx.lineWidth = 1; ctx.strokeRect(p.x, p.y, CELL, CELL); continue; }
    ctx.fillStyle = hexA(B.uiAccent, .16); ctx.fillRect(p.x, p.y, CELL, CELL);
    ctx.strokeStyle = hexA(B.uiAccent, .8); ctx.lineWidth = r.id === currentRoom ? 2.5 : 1.2;
    ctx.strokeRect(p.x, p.y, CELL, CELL);
    if (r.id === currentRoom) { ctx.fillStyle = "#EAFBFF"; ctx.beginPath(); ctx.arc(p.x + CELL / 2, p.y + CELL / 2, 4 + Math.sin(performance.now() * .006) * 1.2, 0, 7); ctx.fill(); }
    // имя биома мелким
    ctx.fillStyle = hexA(B.uiAccent, .75); ctx.font = "700 8px ui-monospace,monospace"; ctx.textAlign = "center";
    ctx.fillText(r.biome.toUpperCase(), p.x + CELL / 2, p.y + CELL - 4);
    // иконки
    let ix = p.x + 8, iy = p.y + 12;
    const icon = (ch, col) => { ctx.fillStyle = col; ctx.font = "900 11px ui-monospace,monospace"; ctx.textAlign = "left"; ctx.fillText(ch, ix, iy); ix += 11; };
    if (r.safe) icon("⌂", "#8AF2FF");
    if ((r.items || []).some(i => i.t === "shop")) icon("$", "#FFD700");
    if (r.boss) icon("☠", saveRef && saveRef.bosses && saveRef.bosses.includes(r.boss.id) ? "#5A6A7A" : "#FF2D78");
    if ((r.items || []).some(i => i.t === "chest") || r.cracks?.length) icon("◆", "#FFE66D");
    if ((r.lifts || []).length || (r.doors || []).some(d => d.s === "N" || d.s === "S")) icon("⇕", "#9AA8B8");
  }
}
function hexA(hex, a) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
// миникарта: текущая комната + открытые соседи
export function drawMinimap(currentRoom, playerPos, saveRef) {
  const cvs = document.getElementById("minimap"); if (!cvs) return;
  const c = cvs.getContext("2d"); if (!c) return;
  const W = cvs.width, H = cvs.height;
  c.fillStyle = "#0B141C"; c.fillRect(0, 0, W, H);
  if (!currentRoom) { c.fillStyle = "#5A6A7A"; c.font = "8px monospace"; c.textAlign = "center"; c.fillText("MAP — TAB", W / 2, H / 2); return; }
  const cur = ROOM_BY_ID[currentRoom]; if (!cur) return;
  const b = bounds();
  const cs = 16;
  const cx = W / 2, cy = H / 2;
  for (const r of ROOMS) {
    const dx = r.map[0] - cur.map[0], dy = r.map[1] - cur.map[1];
    if (Math.abs(dx) > 3 || Math.abs(dy) > 2) continue;
    const x = cx + dx * (cs + 3) - cs / 2, y = cy + dy * (cs + 3) - cs / 2;
    if (!discovered.has(r.id)) { c.strokeStyle = "rgba(70,90,110,.3)"; c.strokeRect(x, y, cs, cs); continue; }
    const B = BIOMES[r.biome];
    c.fillStyle = hexA(B.uiAccent, r.id === currentRoom ? .5 : .18);
    c.fillRect(x, y, cs, cs);
    c.strokeStyle = hexA(B.uiAccent, .8); c.lineWidth = r.id === currentRoom ? 1.6 : .8; c.strokeRect(x, y, cs, cs);
    if (r.safe) { c.fillStyle = "#8AF2FF"; c.fillRect(x + cs / 2 - 1, y + cs / 2 - 1, 2, 2); }
  }
  // игрок внутри текущей клетки
  const o = { x: 0, y: 0 };
  if (playerPos) {
    const lx = (playerPos.x - playerPos.ox) / 40, ly = (playerPos.y - playerPos.oy) / 22;
    c.fillStyle = "#00F5FF"; c.shadowColor = "#00F5FF"; c.shadowBlur = 5;
    c.beginPath(); c.arc(cx - cs / 2 + lx * cs, cy - cs / 2 + (1 - ly) * cs, 2, 0, 7); c.fill();
    c.shadowBlur = 0;
  }
}
