// grid43.js — 4 cols x 3 rows compact grid (12 big screens ~44x12)
// Replaces 1480-unit sprawl. Mechanics (snapToGround, climbing, arena, legs/grip, saves) stay.
// Screen (c,r) origin X=c*48-33, tier baseY r*12 abstract: row2 y0-12 depths/street, row1 y12-24 mid, row0 y24-36 roofs
// But r index 0=top,1=mid,2=bottom => baseY = (2 - r)*12
// Gate plan: legs-shaft up (col1), grip-shaft down (col2), wings/final col3 stub locked
// Every tier change (N/S between rows same col) has BOTH jump chain (steps<=1.65 gaps<=7) AND ladder shaft with door frames.

export const GRID_COLS = 10; // WAVE 0: 4 existing + 6 new biome columns (venti..set)
export const GRID_ROWS = 3;
export const GRID_W = 44;
export const GRID_H = 12;
export const GRID_STEP_X = 48;
export const GRID_OFFSET_X = -33; // col0 origin -33
export const WORLD_GAP_X = GRID_STEP_X - GRID_W; // 4

// baseY mapping: r0 top 24, r1 mid 12, r2 bottom 0
export function tierBaseY(r){
  // r 0..2 top->bottom
  return (2 - r) * GRID_H;
}
export function screenOrigin(c,r){
  return { x: c*GRID_STEP_X + GRID_OFFSET_X, y: tierBaseY(r) };
}

export const SPAWN = { x:-24, y:1.1, c:0, r:2 };

// district + dressing per screen — CHOSEN MAPPING (V2-canon sequential):
// col0 base (sewers/street, street, roofs)
// col1 row2 sunken-west water, row1 market+ГРОХОТ, row0 roofs
// col2 row2 sunken-east + ТИНА arena, row1 crypt+МОЛЧУН, row0 spires
// col3 maw (gates, ГЛИТЧ preview, final descent) — sunken placed in row2 depths row, not col3
// WAVE 0 — biome table per column (district + dressing per row). New biomes = new table rows, not hand carving.
export const BIOME_TABLE=[
  { id:"base",     district:"base",     dressing:["roofs","street","sewers/street"] },
  { id:"market",   district:"market",   dressing:["roofs","market+ГРОХОТ mid","sunken west water"], rowDistrict:{2:"sunken"} },
  { id:"crypt",    district:"crypt",    dressing:["spires","crypt halls+МОЛЧУН mid","sunken east + ТИНА arena"], rowDistrict:{2:"sunken"} },
  { id:"maw",      district:"maw",      dressing:["maw gates","ГЛИТЧ preview","final descent"] },
  // WAVE 1+ — new biomes (col4..col9), each = new traversal mechanic + enemies + boss + ware
  { id:"venti",    district:"venti",    dressing:["vent entry","vent maze","vent depths"] },
  { id:"stoki",    district:"stoki",    dressing:["acid shores","acid flows","acid deep"] },
  { id:"kristall", district:"kristall", dressing:["crystal gate","crystal halls","crystal heart"] },
  { id:"stanciya", district:"stanciya", dressing:["station yard","station halls","station core"] },
  { id:"sady",     district:"sady",     dressing:["garden gates","sky gardens","garden roots"] },
  { id:"set",      district:"set",      dressing:["net veil","net halls","net core"] },
];
export const SCREENS = (() => {
  const out=[];
  for(let r=0;r<GRID_ROWS;r++){
    for(let c=0;c<GRID_COLS;c++){
      const o=screenOrigin(c,r);
      const b=BIOME_TABLE[c]||BIOME_TABLE[0];
      out.push({ col:c, row:r, originX:o.x, baseY:o.y, district:(b.rowDistrict&&b.rowDistrict[r])||b.district, dressing:b.dressing[r]||"street", label:`screen_${c}_${r}`, key:`${c}_${r}`, x:o.x, y:o.y, w:GRID_W, h:GRID_H, biome:b.id });
    }
  }
  return out;
})();

export function screenKey(c,r){ return `${c}_${r}`; }
export function getScreen(c,r){ return SCREENS.find(s=>s.col===c && s.row===r) || null; }
export function gridBounds(){
  const minX = GRID_OFFSET_X;
  const maxX = GRID_OFFSET_X + GRID_COLS*GRID_STEP_X;
  const minY = 0;
  const maxY = GRID_H*GRID_ROWS + 6; // top roofs + platform headroom
  return { minX, maxX, minY, maxY };
}

// — helpers to build platforms —
// internal per-screen platforms: 5 plats covering width, yOffsets ensure steps<=1.65 gaps<=7
function perScreenPlatforms(c,r){
  const o=screenOrigin(c,r);
  const baseY=o.y;
  // choose yOffsets per tier: keep within baseY+1..baseY+3.5 to avoid cross-tier overlap except via bridges
  let yOff;
  if(r===2) yOff=[1.10, 2.50, 1.80, 3.00, 2.00]; // bottom street
  else if(r===1) yOff=[1.60, 2.80, 2.00, 3.20, 1.90]; // mid
  else yOff=[1.40, 2.60, 1.90, 3.10, 2.30]; // roofs
  // slight col variation to avoid identical Y
  const colJitter = c===1?0.12: c===2?-0.08: c===3?0.06: (c%2?0.1:-0.06);
  const xOffs=[5,14,22,30,38];
  const widths=[8,6,5.5,6,7];
  const out=[];
  for(let i=0;i<5;i++){
    const x=o.x + xOffs[i];
    const y=baseY + yOff[i] + colJitter;
    const w=widths[i];
    out.push([x,y,0,w]);
  }
  // arena floor extra for c1 r1 ГРОХОТ, c2 r1 МОЛЧУН, c2 r2 ТИНА — keep relative layout 200/320 sigil pattern
  if(c===1 && r===1){
    const ax=o.x + 12.5;
    out.push([ax, baseY+2.20, 0, 7]);
    out.push([ax+11.5, baseY+1.65, 0, 6]);
    out.push([ax+22.5, baseY+2.00, 0, 6]);
  }
  if(c===2 && r===1){
    const ax=o.x + 12.5;
    out.push([ax, baseY+2.20, 0, 7]);
    out.push([ax+11.5, baseY+1.65, 0, 6]);
    out.push([ax+22.5, baseY+2.00, 0, 6]);
  }
  if(c===2 && r===2){
    const ax=o.x + 12.5;
    out.push([ax, baseY+2.20, 0, 7]);
    out.push([ax+11.5, baseY+1.65, 0, 6]);
    out.push([ax+22.5, baseY+2.00, 0, 6]);
  }
  return out;
}

// E/W connectors per row (between col c and c+1 same r)
function ewConnectorPlatforms(){
  const out=[];
  for(let r=0;r<GRID_ROWS;r++){
    const baseY=tierBaseY(r);
    const y=baseY+1.80;
    for(let c=0;c<GRID_COLS-1;c++){
      const ox=screenOrigin(c,r).x;
      const cx=ox + GRID_W + WORLD_GAP_X/2; // seam center  ox+46
      out.push([cx, y, 0, 8]);
    }
  }
  return out;
}

// Vertical jump chains per col (between r2<->r1 and r1<->r0)
function verticalJumpChains(){
  const out=[];
  for(let c=0;c<GRID_COLS;c++){
    const shaftX=screenOrigin(c,0).x + 22; // aligned to internal plat at offset 22
    // shaft between r2(bottom 0) and r1(mid 12): bridge 3.0->13.1 gap ~10 need 7 steps
    // lowerMax 3.0+ jitter, upperMin 13.1 etc => sequence
    const seq01 = [4.40,5.80,7.20,8.60,10.00,11.40,12.80]; // r2->r1
    for(const y of seq01) out.push([shaftX, y, 0, 6]);
    const seq12 = [16.60,18.00,19.40,20.80,22.20,23.60,25.00]; // r1->r0 15.2->25.1
    for(const y of seq12) out.push([shaftX, y, 0, 6]);
  }
  return out;
}

// Ladders per vertical boundary (shafts) — floor-anchored: each ladder bridges the floor
// platform of its lower tier (perScreenPlatforms offset 22) to the floor platform of the tier
// above, so climbing is continuous floor-to-floor with no mid-ladder teleports.
export function gridLadders(){
  const out=[];
  const jit=(c)=> c===1?0.12: c===2?-0.08: c===3?0.06:0;
  for(let c=0;c<GRID_COLS;c++){
    const shaftX=screenOrigin(c,0).x + 22;
    const r2Floor = 0  + 1.80 + jit(c); // perScreen yOff[2]=1.80
    const r1Floor = 12 + 2.00 + jit(c); // yOff[2]=2.00
    const r0Floor = 24 + 1.90 + jit(c); // yOff[2]=1.90
    const aB=r2Floor-0.30, aT=r1Floor+0.30;
    const bB=r1Floor-0.30, bT=r0Floor+0.30;
    // shaft A r2->r1
    out.push({ x:shaftX, yBottom: aB, yTop: aT, yMid:(aB+aT)/2, h:aT-aB, c, rFrom:2, rTo:1, key:`shaft_${c}_2_1`, dir:"N" });
    // shaft B r1->r0
    out.push({ x:shaftX, yBottom: bB, yTop: bT, yMid:(bB+bT)/2, h:bT-bB, c, rFrom:1, rTo:0, key:`shaft_${c}_1_0`, dir:"N" });
  }
  return out;
}

// Gate plan: which shafts are gated — col3 wings + 3-sigil final
export const GATE_PLAN = [
  // LEVEL-DESIGN UX v4.1.20: gate messages name WHERE the ware lives (user got stuck
  // at the final gate not knowing where wings drop)
  { col:1, from:{c:1,r:1}, to:{c:1,r:0}, dir:"N", shaft:"shaft_1_1_0", req:"legs", name:"ДЭШ-НОГИ", msg:"НУЖЕН ДЭШ-НОГИ // арена ГРОХОТ, маркет mid (1_1)" },
  { col:2, from:{c:2,r:1}, to:{c:2,r:2}, dir:"S", shaft:"shaft_2_2_1", req:"grip", name:"ХВАТ", msg:"НУЖЕН ХВАТ // арена МОЛЧУН, крипта mid (2_1)" },
  { col:3, from:{c:3,r:1}, to:{c:3,r:0}, dir:"N", shaft:"shaft_3_1_0", req:"wings", name:"КРЫЛЬЯ", msg:"НУЖЕН КРЫЛЬЯ // арена ТИНА, затопленка восток (2_2)" },
  // LEVEL-DESIGN FIX v4.1.19 — territory 2 entry gate: ВЕНТИ была открыта с ходу, но без ЦЕПа
  // её стены держат игрока внутри (user trap). Теперь вход требует 3 сигила (контент level1
  // завершён), а выход на запад свободен всегда.
  { col:4, from:{c:3,r:2}, to:{c:4,r:2}, dir:"E", shaft:"east_maw_venti", req:"sigils3", name:"3 СИГИЛА", msg:"ТЕРРИТОРИЯ 2 // НУЖНЫ 3 СИГИЛА: ГРОХОТ(1_1) МОЛЧУН(2_1) ТИНА(2_2)" },
  // WAVE 1+ — biome entry gates east (col5..col9), each requires the previous biome's ware
  { col:5, from:{c:4,r:2}, to:{c:5,r:2}, dir:"E", shaft:"east_venti_stoki", req:"claw", name:"ЦЕП", msg:"НУЖЕН ЦЕП // сундук в ВЕНТИ-глубинах (4_2)" },
];

// HK-FEEL PASS — sealed floor under the final boss arena (col3 r2, ПАСТЬ).
// ГЛИТЧ-МАТЬ's screen sits directly above the kill-plane: knockback or a missed jump mid-fight
// used to mean pit death → checkpoint → whole encounter reset (anti-HK: boss arenas are sealed).
// Slabs at baseY+0.95 keep the fall survivable AND climbable back (step to the 2.0 tier = 1.05 ≤ 1.65).
export function bossArenaFloor(){
  const s=getScreen(3,2);
  const fy=s.baseY+0.95;
  // v4.1.21: slabs OVERLAP the screen boundaries (o-2 … o+48): the old o+1…o+47 span left a
  // 2-unit void slit at every seam → fell there = death + respawn in the same room (user trap at 9_2)
  return [
    [s.originX+8,  fy, 0, 20],
    [s.originX+24, fy, 0, 16],
    [s.originX+40, fy, 0, 16],
  ];
}
// LEVEL-DESIGN FIX v4.1.19 — sealed street floors for the UNFINISHED territories (cols 4-9):
// work-in-progress biomes must not kill with void pits; a fall lands on the street and is
// climbable back (step to the 2.0 tier = 1.05 ≤ 1.65). Level 1 keeps its authored hazards.
export function wipSafetyFloors(){
  const out=[];
  for(let c=4;c<GRID_COLS;c++){
    const s=getScreen(c,2);
    const fy=s.baseY+0.95;
    // v4.1.21: overlap seams (previous screen's last slab ends at its o+48 = this o)
    out.push([s.originX+8,fy,0,20],[s.originX+24,fy,0,16],[s.originX+40,fy,0,16]);
  }
  return out;
}
// Build all platforms for grid
export function buildGridPlatforms(){
  const out=[];
  for(let r=0;r<GRID_ROWS;r++){
    for(let c=0;c<GRID_COLS;c++){
      out.push(...perScreenPlatforms(c,r));
    }
  }
  out.push(...ewConnectorPlatforms());
  out.push(...verticalJumpChains());
  out.push(...bossArenaFloor());
  out.push(...wipSafetyFloors());
  return out;
}

export const GRID_PLATFORMS = buildGridPlatforms();
export const GRID_EW = ewConnectorPlatforms();
export const GRID_VERT = verticalJumpChains();
export const GRID_LADDERS = gridLadders();

// WAVE 1 — ВЕНТИ: walls at the SCREEN EDGES (offsets 2 and 42) — wall-jump surfaces for vertical
// traversal between tiers; the platform path stays clear (walls no longer block platform gaps)
export function gridWalls(){
  const out=[];
  for(const s of SCREENS){
    if(s.district!=="venti") continue;
    for(const xo of [2,42]){
      out.push({ x:s.originX+xo, yBottom:s.baseY+3.0, yTop:s.baseY+13.5, col:s.col, row:s.row, key:s.key });
    }
  }
  return out;
}
export const GRID_WALLS = gridWalls();

// Checkpoints: 1 per screen (center snapped). For BFS we provide snapped later via snapToGround, but define raw
export const GRID_CHECKPOINTS = (() => {
  const out=[];
  for(const s of SCREENS){
    const x=s.originX + 22;
    const y=s.baseY + 1.8;
    out.push({ x, y, done:false, key:s.key, col:s.col, row:s.row, district:s.district });
  }
  // ensure spawn checkpoint not duplicated: spawn is at -24,1.1 which lies in screen 0_2, keep as is but add explicit spawn check? We'll keep 12.
  return out;
})();

// Enemy spawns: district-typed — sunken ghost/guardian, maw skeleton/guardian
export function gridEnemySpawns(){
  const out=[];
  for(const s of SCREENS){
    const ox=s.originX;
    const baseY=s.baseY;
    const y=baseY+2.0;
    let etype="drone";
    if(s.district==="market") etype="netrunner";
    else if(s.district==="crypt") etype="ghost";
    else if(s.district==="sunken") etype="ghost";
    else if(s.district==="maw") etype="guardian";
    else if(s.district==="venti") etype="crawler";     // WAVE 1: ползуны-стенолазы
    else if(s.district==="stoki") etype="ghost";       // WAVE 2: кислотники later
    else if(s.district==="kristall") etype="skeleton"; // WAVE 3: кристаллы later
    else if(s.district==="stanciya") etype="netrunner";// WAVE 4: искры later
    else if(s.district==="sady") etype="drone";        // WAVE 5: садовники later
    else if(s.district==="set") etype="ghost";         // WAVE 6: программы later
    else etype="dog";
    // arena screens handled via triggers; still place one outside
    if(s.col===1 && s.row===1){
      out.push([ox+6, baseY+2.0, 0, "dog"]);
    } else if(s.col===2 && s.row===1){
      out.push([ox+6, baseY+2.0, 0, "skeleton"]);
    } else if(s.col===2 && s.row===2){
      // ТИНА arena handled via trigger; place one guardian outside
      out.push([ox+6, baseY+2.0, 0, "ghost"]);
    } else {
      // WAVE 0 fix: boss room (last col bottom) lighter — the boss is the challenge, 1 enemy only
      if(s.col===GRID_COLS-1 && s.row===2){
        out.push([ox+10, y, 0, etype]);
      } else {
      out.push([ox+10, y, 0, etype]);
      if(s.col!==0 || s.row!==2){
        let second=etype;
        if(s.district==="sunken") second=(ox%2===0?"ghost":"guardian");
        else if(etype==="netrunner") second="netrunner";
        else if(etype==="ghost") second="ghost";
        else second=etype;
        out.push([ox+32, y, s.district==="maw"?1:0, second]);
      } else if(s.district==="sunken"){
        out.push([ox+32, y, 1, "guardian"]);
      }
      }
    }
  }
  return out;
}
export const GRID_ENEMIES = gridEnemySpawns();

// WAVE 0 — LEVELS: каждый уровень = отдельная подгрузка (свои меши/фон/враги). Level 1 = базовая территория 4 колонки.
export const LEVELS=[
  { id:"ter1",   name:"ТЕРРИТОРИЯ 1 // НЕОН-ГОРОД", cols:[0,1,2,3], entryCol:0, exitCol:3 },
  { id:"venti",  name:"ТЕРРИТОРИЯ 2 // ВЕНТИ",      cols:[4],       entryCol:4, exitCol:4 },
  { id:"stoki",  name:"ТЕРРИТОРИЯ 3 // СТОКИ",      cols:[5],       entryCol:5, exitCol:5 },
  { id:"kristall",name:"ТЕРРИТОРИЯ 4 // КРИСТАЛЛ",  cols:[6],       entryCol:6, exitCol:6 },
  { id:"stanciya",name:"ТЕРРИТОРИЯ 5 // СТАНЦИЯ",   cols:[7],       entryCol:7, exitCol:7 },
  { id:"sady",   name:"ТЕРРИТОРИЯ 6 // САДЫ",       cols:[8],       entryCol:8, exitCol:8 },
  { id:"set",    name:"ТЕРРИТОРИЯ 7 // СЕТЬ",       cols:[9],       entryCol:9, exitCol:9 },
];
export function levelOfCol(c){ return LEVELS.find(l=>l.cols.includes(c)) || LEVELS[0]; }

// Boss / final gate location at col3 r2 final descent east edge
export const BOSS_SPAWN = (() => {
  const s=getScreen(3,2);
  return [s.originX + 38, s.baseY + 2.5, 1, "guardian"];
})();
export const FINAL_GATE_X = (() => { const s=getScreen(GRID_COLS-1,2); return s.originX + GRID_W + 2; })();

// Arena consts for compat with main.js market/crypt/sunken arena logic
export const ARENA_ORIGIN_X = screenOrigin(1,1).x + 12.5; // col1 r1 ГРОХОТ MK
export const ARENA_CHEST_X = ARENA_ORIGIN_X;
export const CRYPT_ARENA_ORIGIN_X = screenOrigin(2,1).x + 12.5; // col2 r1 МОЛЧУН CR
export const CRYPT_ARENA_CHEST_X = CRYPT_ARENA_ORIGIN_X;
export const TINA_ARENA_ORIGIN_X = screenOrigin(2,2).x + 12.5; // col2 r2 ТИНА SN
export const TINA_ARENA_CHEST_X = TINA_ARENA_ORIGIN_X;
export const WINGS_CHEST_X = TINA_ARENA_ORIGIN_X + 20; // wings chest behind ТИНА
export const SUNKEN_WATER_SCREENS = ["1_2","2_2"];

// Decor / water stubs for world.js compat — sunken water + pyre/shop stubs
export function gridDecorToWorld(){
  const out=[];
  for(const s of SCREENS){
    let type="sign";
    if(s.district==="market") type="billboard";
    else if(s.district==="crypt") type="server";
    else if(s.district==="sunken") type="server";
    else if(s.district==="maw") type="awning";
    else if(s.district==="venti") type="pipe";       // WAVE 1
    else if(s.district==="stoki") type="pipe";       // WAVE 2
    else if(s.district==="kristall") type="server";  // WAVE 3
    else if(s.district==="stanciya") type="server";  // WAVE 4
    else if(s.district==="sady") type="storefront";  // WAVE 5
    else if(s.district==="set") type="billboard";    // WAVE 6
    else if(s.district==="base" && s.row===0) type="storefront";
    out.push({ type, x:s.originX+16, y:s.baseY+2.6, variant:0, col:s.col, row:s.row, key:s.key });
  }
  return out;
}
export function gridWaterToWorld(){
  // sunken water volumes at 1_2 west and 2_2 east (shallow wading planes)
  const s1=getScreen(1,2);
  const s2=getScreen(2,2);
  return [
    { x:s1.originX+4, y:s1.baseY+0.02, w:36, h:0.22, col:1, row:2, key:"1_2" },
    { x:s2.originX+2, y:s2.baseY+0.02, w:40, h:0.22, col:2, row:2, key:"2_2" },
  ];
}
export function gridPitsToWorld(){ return []; }
// pyres 3: base sewers, market roofs, crypt spires edge (no new PointLights — emissive only)
export function gridPyres(){
  const sA=getScreen(0,2);
  const sB=getScreen(1,1);
  const sC=getScreen(2,0);
  return [
    { id:"pyre_base", x:sA.originX+28, y:sA.baseY+0.9, col:0,row:2, key:"pyre_base" },
    { id:"pyre_market", x:sB.originX+32, y:sB.baseY+0.9, col:1,row:1, key:"pyre_market" },
    { id:"pyre_crypt", x:sC.originX+36, y:sC.baseY+0.9, col:2,row:0, key:"pyre_crypt" },
  ];
}
export function gridShops(){
  const sM=getScreen(1,0);
  const sK=getScreen(2,1);
  return [
    { id:"shop_scalpel", x:sM.originX+12, y:sM.baseY+0.9, col:1,row:0, key:"shop_scalpel", name:"СКАЛЬПЕЛЬ", npc:"scalpel" },
    { id:"shop_boner", x:sK.originX+38, y:sK.baseY+0.9, col:2,row:1, key:"shop_boner", name:"КОСТОРЕЗ", npc:"boner" },
  ];
}
// ladders/pits/decor re-exports for world compat
export const GRID_DECOR = gridDecorToWorld();
export const GRID_WATER = gridWaterToWorld();
export const GRID_PYRES = gridPyres();
export const GRID_SHOPS = gridShops();
