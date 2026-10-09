// crypt.js — Data-Crypt district (16 rooms, 4x4) verbatim from V2 rooms_data.gd crypt_* + world_gen GATE_LINKS + DISTRICT_GRID
// Mirrors js/market.js patterns: ZONE_W 44 sequential (ry*4+rx), Y_SCALE 0.55 BASE_Y 1.0, steps<=1.65 gaps<=7
// Verbatim sources: rooms_data.gd crypt_0_0..crypt_3_3, world_gen.gd GATE_LINKS crypt E grip, DISTRICT_GRID crypt [4,4]

export const W = 40;
export const H = 22;
export const T = 16;
export const ROOM_W = 640;
export const GAP = 16;
export const ROOM_STEP = ROOM_W + GAP;

export const Y_SCALE = 0.55;
export const X_SCALE = 1;
export const BASE_Y = 1.0;
// beyond market east maxX+30: market maxX ~ zoneOrigin(3,2)+W+10 = 679+40+10=729; +30=759 => 760 rounded for alignment; use 753 via 195+12*44+30 contiguous sequential
export const CRYPT_ORIGIN_X = 753;
export const ZONE_W = 44;
export function cryptZoneOrigin(rx, ry) {
  return CRYPT_ORIGIN_X + (ry * 4 + rx) * ZONE_W * X_SCALE;
}
// alias for generic use
export function zoneOriginCrypt(rx, ry) { return cryptZoneOrigin(rx, ry); }

// 16 rooms verbatim from V2/content/rooms_data.gd
export const CRYPT_ROOMS = [
  { id: "crypt_0_0", floor: 20, plats: [[5, 17, 6], [15, 14, 6]], enemies: [["skeleton", 350]] },
  { id: "crypt_1_0", floor: 20, plats: [[6, 17, 6], [16, 14, 7], [26, 17, 5]], enemies: [["ghost", 300]], pyre: [80], chests: [[120, "shard", ""]] },
  { id: "crypt_2_0", floor: 19, plats: [[4, 16, 6], [14, 13, 7]], npc: ["informer", "ШЁПОТ", 200], chests: [[450, "cyber", "grip"]] },
  { id: "crypt_0_1", floor: 19, plats: [[5, 16, 6]], pit: [24, 3], enemies: [["skeleton", 420], ["ghost", 150]] },
  { id: "crypt_1_1", floor: 20, plats: [[6, 14, 8], [20, 17, 6]], ladders: [10], enemies: [["netrunner", 350]], pyre: [80] },
  { id: "crypt_2_1", floor: 20, plats: [[5, 17, 6], [15, 14, 6]], enemies: [["ghost", 400]] },
  { id: "crypt_0_2", floor: 20, plats: [[6, 17, 6], [16, 14, 7]], chests: [[200, "eddies", 60]], enemies: [["skeleton", 450]] },
  { id: "crypt_1_2", floor: 20, arena: { name: "МОЛЧУН", sigil: "CR" }, chests: [[320, "sigil", "CR"], [200, "cyber", "servo"]] },
  { id: "crypt_2_2", floor: 19, plats: [[4, 16, 6], [14, 13, 7], [24, 16, 5]], secret: [0, 17], chests: [[40, "eddies", 80], [500, "shard", ""]] },
  { id: "crypt_3_0", floor: 20, plats: [[5, 17, 6], [15, 14, 6], [25, 11, 5]], secret: [1, 15], enemies: [["skeleton", 400], ["ghost", 180]], chests: [[480, "shard", ""]], decor: [["server", 200, 304, 1]] },
  { id: "crypt_3_1", floor: 19, plats: [[4, 16, 5], [13, 13, 7], [23, 16, 5]], enemies: [["skeleton", 320], ["netrunner", 180]], chests: [[440, "eddies", 70]], decor: [["server", 240, 288, 2]] },
  { id: "crypt_3_2", floor: 20, plats: [[6, 17, 6], [16, 14, 7]], ladders: [30], enemies: [["ghost", 350], ["skeleton", 180]], decor: [["server", 320, 304, 3]] },
  { id: "crypt_0_3", floor: 21, plats: [[8, 18, 6], [18, 15, 7], [28, 18, 4]], enemies: [["ghost", 300], ["skeleton", 450]], chests: [[360, "eddies", 60]], decor: [["server", 160, 320, 0]] },
  { id: "crypt_1_3", floor: 19, plats: [[5, 16, 6], [15, 13, 6], [25, 16, 5]], secret: [35, 16], enemies: [["netrunner", 380], ["ghost", 200]], chests: [[500, "shard", ""], [40, "eddies", 70]] },
  { id: "crypt_2_3", floor: 20, plats: [[6, 17, 6], [16, 14, 6], [26, 17, 5]], npc: ["informer", "ТЕНЬ", 220], enemies: [["ghost", 420]], decor: [["server", 280, 304, 4]] },
  { id: "crypt_3_3", floor: 18, plats: [[5, 15, 6], [15, 12, 6], [25, 15, 6]], ladders: [33], enemies: [["skeleton", 300], ["ghost", 460]], pyre: [80], gate: { rule: "no_dash", door_x: 48, ped_x: 560 }, chests: [[340, "eddies", 80]], decor: [["server", 120, 272, 5]] },
];

export const GATE_LINKS = { crypt: { E: "grip" } };
const GATE_NAMES = { legs: "ДЭШ-НОГИ", grip: "ХВАТ", icarus: "КРЫЛЬЯ" };
export function gateLinkBlocking(district, side, hasGrip) {
  const req = GATE_LINKS[district]?.[side];
  if (!req) return null;
  if (hasGrip) return null;
  const name = GATE_NAMES[req] || req.toUpperCase();
  return `НУЖЕН ${name}`;
}

// Arena consts for crypt_1_2 МОЛЧУН sigil CR
export const CRYPT_ARENA_ROOM = "crypt_1_2";
export const CRYPT_ARENA_ORIGIN_X = cryptZoneOrigin(1, 2);
export const CRYPT_ARENA_CHEST_X = CRYPT_ARENA_ORIGIN_X + 200 / T;
export const CRYPT_ARENA_SIGIL_X = CRYPT_ARENA_ORIGIN_X + 320 / T;
export function cryptArenaBounds() {
  return { minX: CRYPT_ARENA_ORIGIN_X, maxX: CRYPT_ARENA_ORIGIN_X + W * X_SCALE, minY: BASE_Y - 0.5, maxY: BASE_Y + 4.5 };
}
export function isInCryptArena(x, y) {
  const b = cryptArenaBounds();
  return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;
}

// Adapter tile -> world (same scaling as market)
export function toCryptPlatforms() {
  const out = [];
  for (const r of CRYPT_ROOMS) {
    const parts = r.id.split("_");
    const rx = parseInt(parts[1], 10);
    const ry = parseInt(parts[2], 10);
    const floor = r.floor ?? 20;
    const plats = r.plats ?? [];
    for (const pl of plats) {
      const px = pl[0];
      const py = pl[1];
      const pw = pl[2];
      const delta = floor - py;
      const clamped = Math.max(0, Math.min(delta, 3));
      const y = BASE_Y + clamped * Y_SCALE;
      const roomOrigin = cryptZoneOrigin(rx, ry);
      const cx = roomOrigin + (px + pw / 2) * X_SCALE;
      const w = pw * X_SCALE;
      out.push([cx, y, 0, w]);
    }
  }
  return out;
}

// Enemy mapping: skeleton->drone-fly, ghost->drone-fly, guardian/ghost drift, netrunner->heavy, dog variants
export function toCryptEnemies() {
  const out = [];
  for (const r of CRYPT_ROOMS) {
    const parts = r.id.split("_");
    const rx = parseInt(parts[1], 10);
    const ry = parseInt(parts[2], 10);
    const roomOrigin = cryptZoneOrigin(rx, ry);
    for (const e of (r.enemies ?? [])) {
      const type = e[0];
      const pixelX = e[1];
      const tileX = pixelX / T;
      const y = BASE_Y + 2 * Y_SCALE;
      const x = roomOrigin + tileX * X_SCALE;
      let t = 0;
      let etype = type;
      if (type === "netrunner") { t = 1; etype = "netrunner"; }
      else if (type === "ghost") { t = 0; etype = "ghost"; }
      else if (type === "skeleton") { t = 0; etype = "skeleton"; }
      else if (type === "guardian") { t = 1; etype = "guardian"; }
      else if (type === "dog") { t = 0; etype = "dog"; }
      else { t = 0; etype = type; }
      out.push([x, y, t, etype]);
    }
  }
  return out;
}

export function cryptBounds() {
  const xs = [];
  for (const r of CRYPT_ROOMS) {
    const parts = r.id.split("_");
    const rx = parseInt(parts[1], 10);
    const ry = parseInt(parts[2], 10);
    const zo = cryptZoneOrigin(rx, ry);
    xs.push(zo, zo + W * X_SCALE);
  }
  const plats = toCryptPlatforms();
  for (const p of plats) xs.push(p[0]);
  if (xs.length === 0) return { minX: CRYPT_ORIGIN_X, maxX: CRYPT_ORIGIN_X + 16 * ZONE_W };
  return { minX: Math.min(...xs) - 10, maxX: Math.max(...xs) + 10 };
}

// DISTRICT_GRID + room helpers mirror market
export const DISTRICT_GRID = { crypt: [4, 4] };
export function cryptRoomKey(rx, ry) { return `crypt_${rx}_${ry}`; }
export function cryptParseRoomKey(id) {
  const parts = id.split("_");
  return { rx: parseInt(parts[1], 10), ry: parseInt(parts[2], 10) };
}
export function getCryptRoom(rx, ry) {
  const key = cryptRoomKey(rx, ry);
  return CRYPT_ROOMS.find((r) => r.id === key) || null;
}
export function cryptRoomNeighbor(rx, ry, dir) {
  const [w, h] = DISTRICT_GRID.crypt;
  let nrx = rx, nry = ry;
  if (dir === "N") nry = ry - 1;
  else if (dir === "S") nry = ry + 1;
  else if (dir === "E") nrx = rx + 1;
  else if (dir === "W") nrx = rx - 1;
  if (nrx < 0 || nrx >= w || nry < 0 || nry >= h) return null;
  return { rx: nrx, ry: nry, key: cryptRoomKey(nrx, nry), room: getCryptRoom(nrx, nry) };
}

// Compat aliases
export const roomGrid = { DISTRICT_GRID, roomKey: cryptRoomKey, parseRoomKey: cryptParseRoomKey, getRoom: getCryptRoom, neighbor: cryptRoomNeighbor };
export function getNeighbor(rx, ry, dir) { return cryptRoomNeighbor(rx, ry, dir); }

// Ladders → world
export function laddersToWorld() {
  const out = [];
  for (const r of CRYPT_ROOMS) {
    const parts = r.id.split("_");
    const rx = parseInt(parts[1], 10);
    const ry = parseInt(parts[2], 10);
    const ladders = r.ladders ?? [];
    const roomOrigin = cryptZoneOrigin(rx, ry);
    const plats = r.plats ?? [];
    let maxPlatY = BASE_Y + 2 * Y_SCALE;
    for (const pl of plats) {
      const py = pl[1];
      const floor = r.floor ?? 20;
      const delta = floor - py;
      const clamped = Math.max(0, Math.min(delta, 3));
      const y = BASE_Y + clamped * Y_SCALE;
      if (y > maxPlatY) maxPlatY = y;
    }
    const yBottom = BASE_Y - 0.45;
    const yTop = maxPlatY + 1.55;
    const yMid = (yBottom + yTop) / 2;
    const h = yTop - yBottom;
    for (const tileX of ladders) {
      const x = roomOrigin + tileX * X_SCALE;
      out.push({ x, yBottom, yTop, yMid, h, rx, ry, tileX, key: r.id });
    }
  }
  return out;
}

// Pits → world
export function pitsToWorld() {
  const out = [];
  for (const r of CRYPT_ROOMS) {
    const pit = r.pit;
    if (!pit) continue;
    const parts = r.id.split("_");
    const rx = parseInt(parts[1], 10);
    const ry = parseInt(parts[2], 10);
    const roomOrigin = cryptZoneOrigin(rx, ry);
    const tileX = pit[0];
    const tileW = pit[1];
    const x = roomOrigin + tileX * X_SCALE;
    const w = tileW * X_SCALE;
    const x2 = x + w;
    const cx = x + w / 2;
    out.push({ x, x2, cx, w, tileX, tileW, rx, ry, key: r.id, y: BASE_Y });
  }
  return out;
}

// Decor → world (server rows)
export function decorToWorld() {
  const out = [];
  for (const r of CRYPT_ROOMS) {
    const decor = r.decor ?? [];
    if (decor.length === 0) continue;
    const parts = r.id.split("_");
    const rx = parseInt(parts[1], 10);
    const ry = parseInt(parts[2], 10);
    const zo = cryptZoneOrigin(rx, ry);
    for (const d of decor) {
      const type = d[0];
      const xPix = d[1] ?? 0;
      const yPix = d[2] ?? 0;
      const variant = d[3] ?? 0;
      const x = zo + (xPix / T) * X_SCALE;
      const yOffset = Math.max(0, Math.min(3, (320 - yPix) / T * Y_SCALE * 0.35));
      const y = BASE_Y + 0.6 + yOffset + variant * 0.15;
      out.push({ type, x, y, variant, rx, ry, key: r.id, raw: d });
    }
  }
  return out;
}

// Water → world
export function waterToWorld() {
  const out = [];
  for (const r of CRYPT_ROOMS) {
    const water = r.water;
    if (!water) continue;
    const parts = r.id.split("_");
    const rx = parseInt(parts[1], 10);
    const ry = parseInt(parts[2], 10);
    const zo = cryptZoneOrigin(rx, ry);
    const entries = Array.isArray(water[0]) ? water : [water];
    for (const w of entries) {
      if (!Array.isArray(w)) continue;
      const xPix = w[0] ?? 0;
      const wPix = w[1] ?? 40;
      const hPix = w[3] ?? 16;
      const x = zo + (xPix / T) * X_SCALE;
      const ww = (wPix / T) * X_SCALE;
      const y = BASE_Y - 0.05;
      out.push({ x, y, w: ww, h: (hPix / T) * Y_SCALE, rx, ry, key: r.id });
    }
  }
  return out;
}
