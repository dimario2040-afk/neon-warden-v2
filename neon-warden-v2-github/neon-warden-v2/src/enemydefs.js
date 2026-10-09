// enemydefs.js — регистр архетипов врагов и боссов (data-driven: спавны лежат в rooms.js).
// Два класса паттернов: ГЕОМЕТРИЧЕСКИЕ/ТАЙМЕРНЫЕ (маршрут, синус, орбита, таймер-прыжок, рельса,
// скан-луч, сетка) и РЕАГИРУЮЩИЕ (преследование, засада, дистанционка, щит, глушилка, призыв).
// Контракт телеграфа: перед уроном всегда windup (мигание core + рост eye) — окно для уклонения.
import * as THREE from "three";
import { burst, impactRing, addShake, ghostTrail } from "./fx.js";
import { sfx } from "./audio.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const PAL = {
  neon: { base: 0x16303E, em: 0x62f6ff, eye: 0xffffff },
  prom: { base: 0x3A2410, em: 0xff8c1a, eye: 0xffd9a0 },
  mega: { base: 0x2A1845, em: 0x8a5cff, eye: 0xffe66d },
  stoki: { base: 0x1A3A2A, em: 0x39FF14, eye: 0xEAFFE0 },
  pusto: { base: 0x4A3A20, em: 0xFFB040, eye: 0xFFF0C0 },
  set: { base: 0x2A1040, em: 0xFF2D78, eye: 0xC9FFE8 },
};
function mats(p) {
  return {
    body: new THREE.MeshStandardMaterial({ color: p.base, emissive: p.em, emissiveIntensity: 3.0, metalness: .75, roughness: .25 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x7A8A99, metalness: .85, roughness: .22 }),
    eye: new THREE.MeshBasicMaterial({ color: p.eye }),
  };
}
function healthbar(g, y, color) {
  const hb = new THREE.Group(); hb.position.set(0, y, .05);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(1.25, .11), new THREE.MeshBasicMaterial({ color: 0x120b16, transparent: true, opacity: .9 }));
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(1.17, .07), new THREE.MeshBasicMaterial({ color }));
  fill.position.z = .01; hb.add(back, fill); g.add(hb); return fill;
}
// универсальный силуэт-конструктор: core (мигает при телеграфе), eye (растёт), ring
function silhouette(kind, p, variant) {
  const M = mats(p); const g = new THREE.Group(); let core, ring, eye;
  const B = (sx, sy, sz, m, x = 0, y = 0, z = 0) => { const q = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); q.position.set(x, y, z); g.add(q); return q; };
  const parts = {};
  if (kind === "walker") {        // patrol_bot / chaser_dog / shield_guard
    core = B(.8, .55, .5, M.body, 0, .55, 0);
    parts.legL = B(.16, .5, .16, M.trim, -.28, .25, 0); parts.legR = B(.16, .5, .16, M.trim, .28, .25, 0);
    B(.04, .5, .04, M.trim, 0, 1.1, 0); const tip = new THREE.Mesh(new THREE.SphereGeometry(.06, 6, 6), M.eye); tip.position.set(0, 1.38, 0); g.add(tip);
    B(.34, .16, .52, M.body, -.5, .78, 0); B(.34, .16, .52, M.body, .5, .78, 0); // наплечники
    ring = new THREE.Mesh(new THREE.TorusGeometry(.34, .03, 6, 14), M.body); ring.rotation.x = Math.PI / 2; ring.position.y = .9; g.add(ring);
    eye = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), M.eye); eye.position.set(.3, .68, .26); g.add(eye);
    if (variant === "shield") { const sh = B(.12, 1.1, .7, M.trim, .52, .7, 0); sh.name = "shield"; parts.shield = sh; }
    if (variant === "rust") { B(.5, .12, .12, M.trim, 0, .95, 0); }
  } else if (kind === "flyer") {   // sine_drone / orbit_drone / jammer
    core = new THREE.Mesh(new THREE.IcosahedronGeometry(.42, 1), M.body); core.position.y = .8; g.add(core);
    parts.wingL = B(.55, .05, .32, M.trim, -.6, .85, 0); parts.wingR = B(.55, .05, .32, M.trim, .6, .85, 0);
    ring = new THREE.Mesh(new THREE.TorusGeometry(.62, .04, 8, 18), M.body); ring.rotation.x = Math.PI / 2; ring.position.y = .8; g.add(ring);
    eye = new THREE.Mesh(new THREE.SphereGeometry(.1, 10, 8), M.eye); eye.position.set(0, .8, .45); g.add(eye);
    if (variant === "jam") { parts.dish = new THREE.Mesh(new THREE.ConeGeometry(.26, .3, 8, 1, true), M.trim); parts.dish.position.set(0, 1.5, 0); g.add(parts.dish); }
    if (variant === "prog") { const b1 = B(.12, .12, .12, M.eye, .8, .8, 0), b2 = B(.12, .12, .12, M.eye, -.8, .8, 0); parts.bits = [b1, b2]; }
  } else if (kind === "hopper") {  // hopper / grid_mite
    core = new THREE.Mesh(new THREE.SphereGeometry(.34, 10, 8), M.body); core.position.y = .4; g.add(core);
    parts.spring = [B(.06, .36, .06, M.trim, -.2, .12, 0), B(.06, .36, .06, M.trim, .2, .12, 0)];
    for (let i = 0; i < 4; i++) { const l = B(.05, .4, .05, M.trim, Math.cos(i * 1.57 + .78) * .34, .16, Math.sin(i * 1.57 + .78) * .34); l.rotation.z = Math.cos(i * 1.57) * .6; }
    ring = new THREE.Mesh(new THREE.TorusGeometry(.26, .025, 6, 12), M.body); ring.rotation.x = Math.PI / 2; ring.position.y = .45; g.add(ring);
    eye = new THREE.Mesh(new THREE.SphereGeometry(.08, 8, 6), M.eye); eye.position.set(0, .5, .3); g.add(eye);
  } else if (kind === "saw") {     // saw_rail
    core = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, .12, 14), M.body); core.rotation.x = Math.PI / 2; core.position.y = .55; g.add(core);
    for (let i = 0; i < 6; i++) { const t = B(.14, .3, .1, M.trim, Math.cos(i * 1.05) * .6, .55 + Math.sin(i * 1.05) * .6, 0); }
    ring = core; eye = new THREE.Mesh(new THREE.SphereGeometry(.07, 6, 6), M.eye); eye.position.set(0, .55, .1); g.add(eye);
  } else if (kind === "press") {   // ПРЕСС-777: головка пресса на потолочной рейке
    const bodyM = new THREE.MeshStandardMaterial({ color: p.base, emissive: p.em, emissiveIntensity: 1.4, metalness: .7, roughness: .3 });
    const stripe = new THREE.MeshStandardMaterial({ color: 0x2A1A00, emissive: 0xFF8C1A, emissiveIntensity: 2.2 }); stripe.toneMapped = false;
    core = B(2.6, 1.5, 1.6, bodyM, 0, 1.5, 0);                 // корпус головки
    B(3.2, 0.36, 2.0, M.trim, 0, 0.36, 0);                     // штамп-плита (низ ≈0.18)
    for (let i = -3; i <= 3; i++) B(0.2, 0.42, 2.02, i % 2 ? stripe : M.trim, i * 0.44, 0.36, 0); // hazard-полосы
    B(0.6, 7.0, 0.6, M.trim, 0, 5.0, 0);                       // поршень в потолок
    B(1.4, 0.5, 0.5, M.trim, -0.9, 2.4, 0); B(1.4, 0.5, 0.5, M.trim, 0.9, 2.4, 0); // направляющие
    const ventM = new THREE.MeshStandardMaterial({ color: 0x1A0E04, emissive: 0xFF8C1A, emissiveIntensity: 2.0 }); ventM.toneMapped = false;
    eye = B(1.1, 0.5, 0.5, ventM, 0, 1.5, 0.95);               // вент = индикатор телеграфа/overheat
    ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, .06, 8, 24), bodyM); ring.rotation.x = Math.PI / 2; ring.position.y = 0.75; g.add(ring);
  } else if (kind === "turret") {  // scan_turret / summoner
    core = B(.7, .5, .6, M.body, 0, .5, 0);
    parts.head = new THREE.Group(); parts.head.position.set(0, .9, 0);
    const hb = new THREE.Mesh(new THREE.BoxGeometry(.3, .3, .3), M.trim); parts.head.add(hb);
    const he = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), M.eye); he.position.set(0, .05, .3); parts.head.add(he);
    g.add(parts.head);
    ring = new THREE.Mesh(new THREE.TorusGeometry(.5, .03, 6, 16), M.body); ring.rotation.x = Math.PI / 2; ring.position.y = .25; g.add(ring);
    eye = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), M.eye); eye.position.set(0, .95, .3); g.add(eye);
    if (variant === "summon") { const st = B(.06, 1.4, .06, M.trim, 0, 1.4, 0); for (let i = 0; i < 3; i++) { const ob = new THREE.Mesh(new THREE.SphereGeometry(.13, 8, 6), M.eye); ob.position.set(Math.cos(i * 2.09) * .8, 0, Math.sin(i * 2.09) * .8); ring.add(ob); } }
  } else if (kind === "cloak") {   // ambusher
    core = new THREE.Mesh(new THREE.ConeGeometry(.4, 1.3, 6, 1, true), new THREE.MeshStandardMaterial({ color: p.base, emissive: p.em, emissiveIntensity: 2.2, transparent: true, opacity: .5, side: THREE.DoubleSide }));
    core.position.y = .7; g.add(core);
    parts.clawL = B(.06, .9, .06, M.trim, -.45, .8, .2); parts.clawR = B(.06, .9, .06, M.trim, .45, .8, .2);
    ring = new THREE.Mesh(new THREE.TorusGeometry(.4, .02, 6, 14), M.body); ring.rotation.x = Math.PI / 2; ring.position.y = 1.2; g.add(ring);
    eye = new THREE.Mesh(new THREE.SphereGeometry(.08, 8, 6), M.eye); eye.position.set(0, 1.15, .3); g.add(eye);
  } else {                          // gunner
    core = B(.6, .8, .5, M.body, 0, .8, 0);
    B(.1, .6, .1, M.trim, 0, 1.5, 0);
    parts.cannon = B(.55, .16, .16, M.trim, .38, .95, .28);
    ring = new THREE.Mesh(new THREE.TorusGeometry(.4, .03, 6, 14), M.body); ring.rotation.x = Math.PI / 2; ring.position.y = 1.2; g.add(ring);
    eye = new THREE.Mesh(new THREE.SphereGeometry(.08, 8, 6), M.eye); eye.position.set(0, 1.82, 0); g.add(eye);
  }
  g.userData = { core, ring, eye, parts };
  return g;
}

// ── архетипы: hp/dmg/размеры/билдер/ИИ. ИИ получает ctx: {player, room, telegraph, contactOK, fireOrb, spawnAdd, groundY, walls} ──
export const ENEMY_TYPES = {
  // ═══ ГЕОМЕТРИЧЕСКИЕ / ТАЙМЕРНЫЕ ═══
  patrol_bot: { hp: 26, dmg: 10, fly: false, w: .9, h: 1.0, kind: "walker",
    ai(e, dt, c) {
      if (e.dir === undefined) { e.dir = 1; e.x0 = e.x - (e.o.span || 5); e.x1 = e.x + (e.o.span || 5); }
      e.vx = e.dir * 2.2; e.face = e.dir;
      if (e.x < e.x0) e.dir = 1; if (e.x > e.x1) e.dir = -1;
      if (c.wallAhead(e, e.dir)) e.dir *= -1;
    } },
  sine_drone: { hp: 24, dmg: 10, fly: true, w: .8, h: .9, kind: "flyer",
    ai(e, dt, c) { e.tt = (e.tt||0) + dt; e.x = e.ax + Math.sin(e.tt * .7) * (e.o.amp || 4); e.y = e.anchorY + Math.sin(e.tt * 1.3 + 1) * .9; e.face = Math.cos(e.tt * .7) >= 0 ? 1 : -1; } },
  orbit_drone: { hp: 24, dmg: 12, fly: true, w: .8, h: .9, kind: "flyer",
    ai(e, dt, c) { e.t += dt; const R = e.o.R || 2.6, w = e.o.w || 1.4; e.x = e.ax + Math.cos(e.t * w) * R; e.y = e.anchorY + Math.sin(e.t * w) * R * .8; e.face = -Math.sin(e.t * w) >= 0 ? 1 : -1; } },
  hopper: { hp: 22, dmg: 10, fly: false, w: .7, h: .8, kind: "hopper",
    ai(e, dt, c) {
      e.st = e.st || "idle"; e.bt = e.bt === undefined ? 1.0 : e.bt - dt;
      if (e.st === "idle") {
        e.vx = 0;
        if (e.bt <= 0) { e.st = "air"; e.dir = e.dir === undefined ? (Math.random() < .5 ? -1 : 1) : e.dir; e.vx = e.dir * 5.5; e.vy = 8.2; e.bt = 2; e.stretch = 1; sfx.charge?.(); }
        else if (e.bt < 0.3) e.g.scale.y = .8; // telegraph crouch
      } else {
        e.vy -= 22 * dt; e.g.scale.y = 1;
        if (e.y <= e.anchorY && e.vy < 0) { e.y = e.anchorY; e.vy = 0; e.st = "idle"; e.bt = 1.0; if (Math.random() < .5) e.dir *= -1; }
        if (c.wallAhead(e, Math.sign(e.vx || 1))) e.dir *= -1, e.vx *= -1;
      }
      e.face = e.dir || 1;
    } },
  saw_rail: { hp: 1e9, dmg: 16, fly: false, w: 1.1, h: 1.1, kind: "saw", invuln: true, contact: true,
    ai(e, dt, c) {
      if (e.dir === undefined) { e.dir = 1; e.x0 = (e.o.x0 ?? e.x - 6); e.x1 = (e.o.x1 ?? e.x + 6); }
      e.x += e.dir * 4.2 * dt; if (e.x < e.x0) { e.x = e.x0; e.dir = 1; } if (e.x > e.x1) { e.x = e.x1; e.dir = -1; }
      e.g.children[0].rotation.z += dt * 12;
    } },
  scan_turret: { hp: 40, dmg: 12, fly: true, w: .9, h: 1.1, kind: "turret", armored: true, contact: false,
    ai(e, dt, c) {
      e.t += dt; e.lock = Math.max(0, (e.lock || 0) - dt);
      const ang = Math.sin(e.tt * .55) * 1.2 + (e.o.tilt || 0); // луч ±69°
      e.beamAng = ang;
      const dx = Math.cos(ang), dy = Math.sin(ang);
      // ВИДИМЫЙ скан-луч (best practice: угроза читается до урона)
      if (!e.beam) {
        e.beam = new THREE.Mesh(new THREE.BoxGeometry(13, .07, .07), new THREE.MeshBasicMaterial({ color: 0xffe66d, transparent: true, opacity: .5, depthWrite: false }));
        e.beam.material.toneMapped = false; c.extra(e.beam);
      }
      e.beam.position.set(e.x + dx * 6.5, e.y + .95 + dy * 6.5, .1);
      e.beam.rotation.z = ang;
      e.beam.material.color.setHex(e.lock > .15 ? 0xff2d78 : 0xffe66d);
      e.beam.material.opacity = .35 + Math.min(.5, e.lock);
      // попадание луча в игрока
      const px = c.player.x - e.x, py = (c.player.y + 1) - (e.y + .95);
      const proj = px * dx + py * dy, perp = Math.abs(px * dy - py * dx);
      if (proj > 0 && proj < 13 && perp < .6) { e.lock += dt; e.beamHit = true; } else e.beamHit = false;
      if (e.lock > .45 && (e.shotCd || 0) <= 0) {
        e.shotCd = 2.2; e.vulnT = 1.0; c.fireOrb(e.x + dx, e.y + .95 + dy, dx * 9, dy * 9, 0xffe66d, 12, "СКАН-ЛУЧ");
        e.lock = 0; sfx.orb?.();
      }
      e.shotCd = (e.shotCd || 0) - dt; e.vulnT = Math.max(0, (e.vulnT || 0) - dt);
    } },
  grid_mite: { hp: 8, dmg: 8, fly: false, w: .5, h: .5, kind: "hopper",
    ai(e, dt, c) {
      e.step = (e.step || 0) - dt;
      if (e.step <= 0) {
        e.step = .32;
        if (e.dir === undefined || c.wallAhead(e, e.dir) || Math.random() < .12) e.dir = Math.random() < .5 ? -1 : 1;
        e.x += e.dir * 1.0; e.face = e.dir; e.hopPh = 1;
      }
      e.hopPh = Math.max(0, (e.hopPh || 0) - dt * 3);
      e.g.position.y = e.y + Math.sin(e.hopPh * Math.PI) * .3;
    } },
  // ═══ РЕАГИРУЮЩИЕ ═══
  chaser_dog: { hp: 30, dmg: 12, fly: false, w: .95, h: .9, kind: "walker",
    ai(e, dt, c) {
      const dx = c.player.x - e.x;
      if (e.dir === undefined) { e.dir = 1; e.x0 = e.x - 4; e.x1 = e.x + 4; }
      const see = Math.abs(dx) < 10 && Math.abs(c.player.y - e.y) < 3;
      if (see) {
        e.aggro = true; e.face = Math.sign(dx || 1);
        e.vx = e.face * 6.2;
        if (Math.abs(dx) < 1.9 && Math.abs(c.player.y - e.y) < 1.6 && (e.telegraphT || 0) <= 0 && e.atkCd === undefined || (e.atkCd || 0) <= 0 && Math.abs(dx) < 1.9) {
          e.atkCd = .9; c.telegraph(e, .3, 12, "УКУС");
        }
      } else { e.aggro = false; e.vx = e.dir * 2.0; e.face = e.dir; if (e.x < e.x0) e.dir = 1; if (e.x > e.x1) e.dir = -1; }
      e.atkCd = (e.atkCd || 0) - dt;
      if (c.wallAhead(e, Math.sign(e.vx || 1))) e.vx = 0;
    } },
  ambusher: { hp: 26, dmg: 14, fly: false, w: .8, h: 1.3, kind: "cloak",
    ai(e, dt, c) {
      e.st = e.st || "cloak"; e.bt = (e.bt === undefined ? 3 : e.bt - dt);
      const d = Math.hypot(c.player.x - e.x, c.player.y - e.y);
      const vis = e.st === "cloak" ? .08 : .8;
      e.g.userData.core.material.opacity = vis; e.g.userData.ring.material.opacity = vis; e.g.userData.eye.material.opacity = vis;
      if (e.st === "cloak") { e.vx = 0; if (d < 4.5) { e.st = "leap"; e.vy = 7.5; e.vx = Math.sign(c.player.x - e.x || 1) * 6.5; sfx.teleport?.(); burst(e.g.position, 0xff2d78, 10, .05); } }
      else if (e.st === "leap") { e.vy -= 22 * dt; if (e.y <= e.anchorY && e.vy < 0) { e.y = e.anchorY; e.vy = 0; e.vx = 0; e.st = "open"; e.bt = 1.2; } }
      else { e.vx = 0; if (e.bt <= 0) { e.st = "cloak"; e.bt = 3; } } // open = окно уязвимости
    } },
  gunner: { hp: 34, dmg: 10, fly: false, w: .8, h: 1.6, kind: "gunner",
    ai(e, dt, c) {
      const dx = c.player.x - e.x, ad = Math.abs(dx);
      e.face = Math.sign(dx || 1);
      if (ad < 5) e.vx = -e.face * 3.2; else if (ad > 9) e.vx = e.face * 2.6; else e.vx = 0;
      e.shot = (e.shot || 2) - dt; e.wind = Math.max(0, (e.wind || 0) - dt);
      if (e.wind > 0) { e.tt = (e.tt||0) + dt*24; e.g.userData.eye.scale.setScalar(1 + Math.sin(e.tt) * .5); if (e.wind <= dt) { c.fireOrbAimed(e.x, e.y + 1.5, 8.5, 0xff3ea5, 10, "Выстрел"); e.g.userData.eye.scale.setScalar(1); e.shot = 2.4; } }
      else if (e.shot <= 0 && ad < 13 && Math.abs(c.player.y - e.y) < 4) e.wind = .5;
      if (c.wallAhead(e, Math.sign(e.vx || 1))) e.vx = 0;
    } },
  shield_guard: { hp: 60, dmg: 16, fly: false, w: 1.0, h: 1.3, kind: "walker", variant: "shield", shielded: true,
    ai(e, dt, c) {
      const dx = c.player.x - e.x; e.face = Math.sign(dx || 1);
      e.vx = e.face * 1.5;
      if (Math.abs(dx) < 2.0 && Math.abs(c.player.y - e.y) < 1.8 && (e.atkCd || 0) <= 0 && (e.telegraphT || 0) <= 0) { e.atkCd = 1.4; c.telegraph(e, .38, 16, "УДАР ЩИТОМ"); }
      e.atkCd = (e.atkCd || 0) - dt;
      if (c.wallAhead(e, e.face)) e.vx = 0;
    } },
  jammer: { hp: 18, dmg: 8, fly: true, w: .8, h: 1.0, kind: "flyer", variant: "jam",
    ai(e, dt, c) {
      const dx = c.player.x - e.x, ad = Math.abs(dx);
      e.vx = ad < 6 ? -Math.sign(dx || 1) * 3.4 : ad > 10 ? Math.sign(dx || 1) * 2.4 : 0;
      e.tt = (e.tt||0) + dt; e.y = e.anchorY + Math.sin(e.tt * 1.6) * .6;
      e.pulse = (e.pulse || 6) - dt;
      if (e.pulse <= .6 && e.pulse > 0) { e.g.userData.ring.scale.setScalar(1 + (.6 - e.pulse) * 2); }
      else if (e.pulse <= 0) {
        e.pulse = 6; e.g.userData.ring.scale.setScalar(1);
        c.floorRing(e.x, 0xff2d78); sfx.phase?.();
        if (Math.hypot(c.player.x - e.x, c.player.y - e.y) < 7) { c.jam(3); burst(e.g.position, 0xff2d78, 18, .07); }
      }
    } },
  summoner: { hp: 44, dmg: 10, fly: false, w: .9, h: 1.6, kind: "turret", variant: "summon", contact: false,
    ai(e, dt, c) {
      e.cyc = (e.cyc || 0) + dt; e.vx = 0;
      const t = e.cyc % 5;
      e.channel = t > 3.8;
      if (e.channel) { e.g.userData.eye.scale.setScalar(1.6); if (!e.didSummon && t > 4.6) { e.didSummon = true; c.spawnAdd(e.x - 1.5, e.y); c.spawnAdd(e.x + 1.5, e.y); } }
      else { e.g.userData.eye.scale.setScalar(1); e.didSummon = false; }
    } },
};

// ── BOSS-KIT: общие состояния + телеграфы; каждый босс = набор паттернов ──
function bset(e, st, t) { e.bstate = st; e.bt = t; }
function flash(e, on, c) { const core = e.g.userData.core; if (!core) return; if (on) { if (e.baseEm === undefined) { e.baseEm = core.material.emissive.getHex(); e.baseInt = core.material.emissiveIntensity; } core.material.emissive.setHex(c ?? 0xff2d78); core.material.emissiveIntensity = 5.5; } else if (e.baseEm !== undefined) { core.material.emissive.setHex(e.baseEm); core.material.emissiveIntensity = e.baseInt; } }
export const BOSSES = {
  rain_hunter: { hp: 150, dmg: 14, w: 1.2, h: 1.8, kind: "walker", variant: "rust", fly: true, isBossLite: true, name: "ДОЖДЬ-ОХОТНИК",
    ai(e, dt, c) {
      e.phase += dt; if (e.bt === undefined) bset(e, "intro", 1.2); if (!e.announced) { e.announced = true; c.announce("АРХИТЕКТОР СЕТИ // ПЕРИМЕТР ЗАМКНУТ"); } if (!e.announced) { e.announced = true; c.announce("СМОТРИТЕЛЬ БАШНИ // ПРОТОКОЛ ЗАЧИСТКИ"); } if (!e.announced) { e.announced = true; c.announce("ДОЖДЬ-ОХОТНИК // ТЫ В ЕГО МОНУНЕ"); }
      e.bt -= dt;
      const hover = e.anchorY + 1.2 + Math.sin(e.phase * 2) * .4;
      switch (e.bstate) {
        case "intro": e.vx = 0; flash(e, Math.floor(e.phase * 10) % 2 === 0); if (e.bt <= 0) { flash(e, false); bset(e, "idle", .6); } break;
        case "idle": {
          e.vx = Math.sign(c.player.x - e.x) * 2.4; e.face = Math.sign(c.player.x - e.x || 1);
          e.dashes = e.dashes || 0;
          if (e.bt <= 0) { if (e.dashes >= 3) { e.dashes = 0; bset(e, "rain", .8); } else bset(e, "wind", .45); }
          break;
        }
        case "wind": e.vx = 0; e.chargeDir = Math.sign(c.player.x - e.x || 1); flash(e, Math.floor(e.phase * 16) % 2 === 0); if (e.bt <= 0) { flash(e, false); e.vx = e.chargeDir * 14; bset(e, "dash", .7); sfx.dash?.(); } break;
        case "dash": e.trailT = (e.trailT || 0) - dt; if (e.trailT <= 0) { e.trailT = .04; ghostTrail(new THREE.Vector3(e.x, e.y + .9, .12), e.face || 1, 0x00f5ff, 2.4); } if (e.bt <= 0 || c.wallAhead(e, Math.sign(e.vx))) { e.vx = 0; e.dashes++; bset(e, "rest", .8); } break;
        case "rest": e.vx = 0; if (e.bt <= 0) bset(e, "idle", .5); break; // окно уязвимости
        case "rain": { // телеграф-колонны → вертикальные снаряды
          e.vx = 0; flash(e, true, 0x00f5ff);
          if (!e.rainMarks) { e.rainMarks = [c.player.x - 3, c.player.x, c.player.x + 3].map(x => c.clampRoom(x)); for (const x of e.rainMarks) impactRing(new THREE.Vector3(x, e.roomFloor + .1, 0), 0x00f5ff); }
          if (e.bt <= 0) { for (const x of e.rainMarks) c.fireOrb(x, e.y + 6, 0, -11, 0x00f5ff, 12, "ДОЖДЬ"); e.rainMarks = null; flash(e, false); bset(e, "rest", .9); }
          break;
        }
      }
      e.g.position.y = hover; e.y = hover;
    } },
  overseer: { hp: 170, dmg: 16, w: 1.4, h: 2.0, kind: "turret", fly: true, isBossLite: true, name: "СМОТРИТЕЛЬ БАШНИ",
    ai(e, dt, c) {
      e.phase += dt; if (e.bt === undefined) bset(e, "intro", 1.2);
      e.bt -= dt;
      switch (e.bstate) {
        case "intro": flash(e, Math.floor(e.phase * 10) % 2 === 0); if (e.bt <= 0) { flash(e, false); bset(e, "hover", .8); } break;
        case "hover": e.x += (c.player.x - e.x) * Math.min(1, dt * 1.6); e.g.position.y = e.anchorY + 4 + Math.sin(e.phase * 2) * .5; if (e.bt <= 0) { bset(e, "windslam", .55); e.slamX = c.clampRoom(c.player.x); impactRing(new THREE.Vector3(e.slamX, e.roomFloor + .1, 0), 0xffe66d); sfx.charge?.(); } break;
        case "windslam": flash(e, true); e.g.position.y += (e.anchorY + 6 - e.g.position.y) * .1; if (e.bt <= 0) { flash(e, false); bset(e, "fall", 2); e.vy = -24; } break;
        case "fall": e.trailT = (e.trailT || 0) - dt; if (e.trailT <= 0) { e.trailT = .05; ghostTrail(new THREE.Vector3(e.x, e.g.position.y + 1, .12), e.face || 1, 0xffe66d, 2.6); } e.g.position.y += e.vy * dt; e.vy -= 30 * dt;
          if (e.g.position.y <= e.roomFloor) { e.g.position.y = e.roomFloor; addShake(.7, .4); sfx.slam?.(); for (const d of [-1, 1]) { c.fireOrb(e.x + d * 1.2, e.roomFloor + .6, d * 8, 0, 0xffe66d, 14, "УДАРНАЯ ВОЛНА"); } bset(e, "stuck", 1.1); } break;
        case "stuck": if (e.bt <= 0) bset(e, "hover", .7); break; // уязвим
      }
      e.g.position.y = e.g.position.y; e.y = e.g.position.y; // хитбокс = визуал
      e.face = Math.sign(c.player.x - e.x || 1);
    } },
  press_777: { hp: 190, dmg: 22, w: 2.6, h: 2.6, kind: "press", fly: true, contact: false, isBossLite: true, name: "ПРЕСС-777",
    // HK-грамматика: track → aim(маркер-колонна, лок в НАЧАЛЕ) → slam(узкая колонна-хитбокс) →
    // impact(волны по полу, перепрыгиваются) → каждая 3-я серия → overheat(вент открыт = punish-окно) → rise.
    // Урон только явный: колонна слама + волны. Фаза 2 (<50%): быстрее прицел, быстрее волны.
    ai(e, dt, c) {
      e.phase += dt;
      if (e.headY === undefined) { e.headY = e.roomFloor + 8.5; e.volley = 0; }
      const P2 = e.hp < e.max * 0.5;
      const hover = e.roomFloor + (P2 ? 4.8 : 5.4);
      if (e.bt === undefined) { bset(e, "intro", 1.4); c.announce("ПРЕСС-777 // ЦИКЛ УПЛОТНЕНИЯ ЗАПУЩЕН"); sfx.roar?.(); }
      e.bt -= dt;
      const vent = (lv, open) => { const v = e.g.userData.eye; const vm = v && v.material; if (!vm) return; v.scale.setScalar(1 + lv * 0.8); vm.emissiveIntensity = open ? 7 : 1.5 + lv * 2.5; vm.emissive.setHex(open ? 0xEAFBFF : 0xFF8C1A); };
      // маркер-колонна на полу: живёт только во время прицела/слама
      if ((e.bstate === "aim" || e.bstate === "slam") && !e.marker) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(2.8, 26, 0.12), new THREE.MeshBasicMaterial({ color: 0xFF8C1A, transparent: true, opacity: .35, depthWrite: false }));
        m.material.toneMapped = false; m.position.set(e.slamX || e.x, e.roomFloor + 13, 1.2); c.extra(m); e.marker = m;
        const strip = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, 0.5), new THREE.MeshBasicMaterial({ color: 0xFF2D78, transparent: true, opacity: .9, depthWrite: false }));
        strip.material.toneMapped = false; strip.position.set(e.slamX || e.x, e.roomFloor + 0.1, 0.8); c.extra(strip); e.markerStrip = strip;
      }
      if (e.marker) {
        const on = e.bstate === "aim" || e.bstate === "slam";
        e.marker.visible = on; if (e.markerStrip) e.markerStrip.visible = on;
        if (on) {
          e.marker.position.x = e.slamX; if (e.markerStrip) e.markerStrip.position.x = e.slamX;
          const hz = e.bstate === "slam" ? 26 : 8 + (0.9 - Math.min(e.bt, 0.9)) * 14;
          e.marker.material.opacity = Math.floor(e.phase * hz) % 2 === 0 ? .5 : .18;
        }
      }
      switch (e.bstate) {
        case "intro":
          e.x += (c.player.x - e.x) * Math.min(1, dt * 2); e.headY += (hover - e.headY) * Math.min(1, dt * 2.5);
          flash(e, Math.floor(e.phase * 10) % 2 === 0); vent(0.3);
          if (e.bt <= 0) { flash(e, false); bset(e, "track", P2 ? 0.5 : 0.8); }
          break;
        case "track": // головка едет по потолочной рейке над игроком — угрозы нет, чтение ситуации
          e.headY += (hover - e.headY) * Math.min(1, dt * 4);
          e.x += clamp(c.player.x - e.x, -1, 1) * (P2 ? 4.2 : 3.2) * dt;
          vent(0.25);
          if (e.bt <= 0) { bset(e, "aim", P2 ? 0.6 : 0.9); e.slamX = c.clampRoom(c.player.x); e.hitDone = false; sfx.charge?.(); c.floorRing(e.slamX, 0xFF8C1A); }
          break;
        case "aim": // телеграф: маркер-колонна мигает всё быстрее, головка центруется над меткой
          e.headY += (hover + 1.2 - e.headY) * Math.min(1, dt * 6);
          e.x += (e.slamX - e.x) * Math.min(1, dt * 8);
          flash(e, Math.floor(e.phase * (P2 ? 20 : 14)) % 2 === 0); vent(0.6);
          if (e.bt <= 0) { flash(e, false); bset(e, "slam", 2); e.vyS = 0; }
          break;
        case "slam": {
          e.vyS = (e.vyS || 0) + 62 * dt; e.headY -= e.vyS * dt; vent(0.2);
          e.trailT = (e.trailT || 0) - dt; if (e.trailT <= 0) { e.trailT = .04; burst(new THREE.Vector3(e.x + (Math.random() - .5) * 2, e.headY + 2, 0), 0xFF8C1A, 2, .05); }
          if (!e.hitDone && Math.abs(c.player.x - e.x) < 1.5 && c.player.y + 1.9 > e.headY + 0.1 && c.player.y < e.headY + 2.6) { e.hitDone = true; c.damagePlayer(22, "ПРЕСС-777", e.x); }
          if (e.headY <= e.roomFloor) {
            e.headY = e.roomFloor; e.volley++;
            addShake(.8, .45); sfx.slam?.(); burst(new THREE.Vector3(e.x, e.roomFloor + .6, 0), 0xFF8C1A, 26, .09);
            c.floorRing(e.x, 0xFFD700);
            for (const d of [-1, 1]) c.fireOrb(e.x + d * 1.9, e.roomFloor + .7, d * (P2 ? 9 : 7.5), 0, 0xff8c1a, 14, "ПРЕСС-ВОЛНА");
            if (e.volley % 3 === 0) bset(e, "overheat", P2 ? 1.9 : 2.4);   // punish-окно
            else { bset(e, "aim", P2 ? 0.45 : 0.6); e.slamX = c.clampRoom(c.player.x); e.hitDone = false; sfx.charge?.(); c.floorRing(e.slamX, 0xFF8C1A); }
          }
          break;
        }
        case "overheat": // вент раскрыт (бело-голубой), искры — окно уязвимости
          vent(1.0, true);
          if (Math.random() < .35) burst(new THREE.Vector3(e.x + (Math.random() - .5) * 2.4, e.roomFloor + 1.6 + Math.random(), 0), 0xEAFBFF, 2, .04);
          e.g.rotation.z = Math.sin(e.phase * 18) * .02;
          if (e.bt <= 0) { e.g.rotation.z = 0; bset(e, "rise", .6); e.volley = 0; }
          break;
        case "rise":
          e.headY += (hover - e.headY) * Math.min(1, dt * 3); vent(0.4);
          if (e.bt <= 0) bset(e, "track", P2 ? 0.4 : 0.7);
          break;
      }
      e.g.position.y = e.headY; e.g.position.x = e.x; e.y = e.headY; // хитбокс = головка пресса
      e.face = Math.sign(c.player.x - e.x || 1);
    } },
  brood_mother: { hp: 230, dmg: 16, w: 1.8, h: 1.8, kind: "flyer", fly: true, isBoss: true, name: "МАТКА СТОКОВ",
    ai(e, dt, c) {
      e.phase += dt; if (e.bt === undefined) bset(e, "intro", 1.3); if (!e.announced) { e.announced = true; c.announce("ГЛИТЧ-МАТЬ // МАТЬ ВСЕХ ПОМЕХ"); } if (!e.announced) { e.announced = true; c.announce("СИРОККО // ПЕСОК ОЖИЛ"); } if (!e.announced) { e.announced = true; c.announce("МАТКА СТОКОВ // ГНЕЗДО ЗАЩИЩАЕТСЯ"); }
      e.bt -= dt;
      const hover = e.anchorY + 1 + Math.sin(e.phase * 1.8) * .5;
      switch (e.bstate) {
        case "intro": flash(e, Math.floor(e.phase * 10) % 2 === 0, 0x39ff14); if (e.bt <= 0) { flash(e, false); bset(e, "idle", .8); } break;
        case "idle":
          e.x += (c.player.x - e.x) * Math.min(1, dt * 1.2);
          if (e.bt <= 0) { const r = Math.random(); bset(e, r < .45 ? "geyser" : r < .75 ? "leap" : "adds", .6); }
          break;
        case "geyser": flash(e, true, 0x39ff14); if (!e.marks) { e.marks = [c.player.x - 2.5, c.player.x + 2.5].map(x => c.clampRoom(x)); for (const x of e.marks) impactRing(new THREE.Vector3(x, e.roomFloor + .1, 0), 0x39FF14); } if (e.bt <= 0) { for (const x of e.marks) c.geyser(x, 1.1); e.marks = null; flash(e, false); bset(e, "idle", .8); } break;
        case "leap": e.vx = 0; if (e.bt <= 0) { e.vy = 10; e.vx = Math.sign(c.player.x - e.x || 1) * 7; bset(e, "air", 2); } break;
        case "air": e.vy -= 22 * dt; e.x += e.vx * dt; e.g.position.y = Math.max(e.roomFloor, e.g.position.y + e.vy * dt);
          if (e.g.position.y <= e.roomFloor && e.vy < 0) { addShake(.6, .35); sfx.slam?.(); for (const d of [-1, 1]) c.fireOrb(e.x + d * 1.4, e.roomFloor + .6, d * 6.5, 0, 0x39FF14, 12, "КИСЛОТНАЯ ВОЛНА"); bset(e, "stun", 1.0); } break;
        case "adds": if (!e.did) { e.did = true; c.spawnAdd(e.x - 2, e.roomFloor); c.spawnAdd(e.x + 2, e.roomFloor); } if (e.bt <= 0) { e.did = false; bset(e, "idle", .7); } break;
        case "stun": if (e.bt <= 0) bset(e, "idle", .5); break;
      }
      if (e.bstate !== "air") e.g.position.y = hover;
      e.y = e.g.position.y;
      e.face = Math.sign(c.player.x - e.x || 1);
    } },
  sirokko: { hp: 250, dmg: 18, w: 2.0, h: 1.6, kind: "hopper", fly: true, contact: false, isBoss: true, name: "ЧЕРВЬ «СИРОККО»",
    ai(e, dt, c) {
      e.phase += dt; if (e.bt === undefined) bset(e, "intro", 1.3);
      e.bt -= dt;
      switch (e.bstate) {
        case "intro": if (e.bt <= 0) bset(e, "burrow", 1.2); break;
        case "burrow": // под песком: трейл к игроку = телеграф
          e.g.position.y = e.roomFloor - 1.2; e.x += (c.player.x - e.x) * Math.min(1, dt * 2.2);
          if (Math.random() < .3) burst(new THREE.Vector3(e.x, e.roomFloor + .1, 0), 0xFFB040, 2, .05);
          if (e.bt <= 0) { bset(e, "emerge", .45); sfx.roar?.(); } break;
        case "emerge": e.g.position.y += (e.roomFloor + 1.4 - e.g.position.y) * Math.min(1, dt * 10); if (Math.random() < .5) burst(new THREE.Vector3(e.x + (Math.random() - .5) * 2, e.roomFloor + .4, 0), 0xFFB040, 2, .05); flash(e, true, 0xffb040); if (e.bt <= 0) { flash(e, false); bset(e, "bite", .35); } break;
        case "bite": if (Math.abs(c.player.x - e.x) < 2.4 && Math.abs(c.player.y - e.roomFloor) < 3) c.damagePlayer(18, "УКУС СИРОККО"); bset(e, "open", 1.4); break; // окно уязвимости
        case "open": e.g.position.y = e.roomFloor + 1.4 + Math.sin(e.phase * 6) * .1; if (e.bt <= 0) { bset(e, "burrow", e.hp < e.max * .5 ? .8 : 1.2); if (e.hp < e.max * .5) { for (const d of [-1, 1]) c.fireOrb(e.x + d, e.roomFloor + .8, d * 7, 2.5, 0xFFB040, 12, "ПЕСЧАНАЯ ВОЛНА"); } } break;
      }
      e.y = e.g.position.y; e.untouchable = (e.bstate === "burrow"); // под песком не бьётся
      e.face = Math.sign(c.player.x - e.x || 1);
    } },
  architect: { hp: 190, dmg: 14, w: 1.2, h: 1.8, kind: "cloak", fly: true, isBossLite: true, name: "АРХИТЕКТОР СЕТИ",
    ai(e, dt, c) {
      e.phase += dt; if (e.bt === undefined) bset(e, "intro", 1.2);
      e.bt -= dt;
      if (!e.nodes) e.nodes = [[e.roomX0 + 6, e.roomFloor + 1], [e.roomX1 - 6, e.roomFloor + 1], [e.roomX0 + 8, e.roomFloor + 6], [e.roomX1 - 8, e.roomFloor + 6]];
      switch (e.bstate) {
        case "intro": flash(e, Math.floor(e.phase * 12) % 2 === 0, 0x00f5ff); if (e.bt <= 0) { flash(e, false); bset(e, "pick", .3); } break;
        case "pick": { const n = e.nodes[(Math.random() * 4) | 0]; burst(e.g.position, 0x00f5ff, 12, .06); e.x = n[0]; e.ny = n[1]; e.g.position.y = n[1]; burst(e.g.position, 0x00f5ff, 12, .06); sfx.teleport?.(); e.combos = (e.combos || 0) + 1; bset(e, "beamwind", .8); break; }
        case "beamwind": flash(e, true, 0xff2d78); e.g.scale.setScalar(1 + Math.sin(e.phase * 26) * .12); if (e.bt <= 0) { flash(e, false); e.g.scale.setScalar(1); c.beamCross(e.x, e.g.position.y, 14); bset(e, "beam", .35); } break;
        case "beam": if (e.bt <= 0) { if (e.combos % 3 === 0) bset(e, "stun", 1.2); else bset(e, "pick", .25); } break;
        case "stun": if (e.bt <= 0) bset(e, "pick", .3); break;
      }
      e.g.position.y = (e.ny ?? e.roomFloor + 1) + Math.sin(e.phase * 2.2) * .15; // hover-bob каждый кадр, не только в pick
      e.y = e.g.position.y; // хитбокс = визуал (узлы телепортов)
      e.face = Math.sign(c.player.x - e.x || 1);
    } },
  glitch_mother: { hp: 300, dmg: 16, w: 1.6, h: 2.2, kind: "turret", variant: "glitch", fly: true, isBoss: true, isFinal: true, name: "ГЛИТЧ-МАТЬ",
    ai(e, dt, c) {
      e.phase += dt; if (e.bt === undefined) bset(e, "intro", 1.3);
      e.bt -= dt;
      const P = e.bphase || 1;
      if (e.bphase === undefined) e.bphase = 1;
      const hpF = e.hp / e.max;
      if (e.bphase === 1 && hpF <= .66) { e.bphase = 2; bset(e, "roar", 1.0); sfx.phase?.(); addShake(.55, .6); }
      else if (e.bphase === 2 && hpF <= .33) { e.bphase = 3; bset(e, "roar", 1.0); sfx.roar?.(); addShake(.7, .8); }
      const hover = e.anchorY + 1.2 + Math.sin(e.phase * (P === 3 ? 3.1 : 2)) * .35;
      switch (e.bstate) {
        case "intro": case "roar": flash(e, Math.floor(e.phase * 10) % 2 === 0); e.g.scale.setScalar(1.5 * (1 + Math.sin(e.phase * 18) * .04)); if (e.bt <= 0) { flash(e, false); e.g.scale.setScalar(1.5); bset(e, "idle", P === 3 ? .35 : .6); } break;
        case "idle": {
          e.x += (c.player.x - e.x) * Math.min(1, dt * 1.4);
          if (e.bt <= 0) { const r = Math.random(); if (P === 1) bset(e, r < .6 ? "windbeam" : "windcharge", .55); else if (P === 2) bset(e, r < .4 ? "windbeam" : r < .72 ? "windcharge" : "tele", .5); else bset(e, r < .3 ? "windburst" : r < .6 ? "windcharge" : r < .82 ? "windbeam" : "tele", .42); if (e.bstate === "windcharge") { e.chargeDir = Math.sign(c.player.x - e.x || 1); sfx.charge?.(); } }
          break;
        }
        case "windbeam": flash(e, Math.floor(e.phase * 14) % 2 === 0); if (e.bt <= 0) { flash(e, false); const n = P >= 3 ? 3 : P >= 2 ? 2 : 1; for (let i = 0; i < n; i++) c.fireOrbAimed(e.x, e.y + 1.1, 9.5 + i * .6, 0x7A4CFF, 13, "ГЛИТЧ-СНАРЯД", .5); bset(e, "idle", P === 3 ? .75 : 1.1); } break;
        case "windcharge": e.g.scale.setScalar(1.5 * (1 - .12 * Math.min(1, (.5 - e.bt) * 2))); if (Math.floor(e.phase * 16) % 2 === 0) flash(e, true); if (e.bt <= 0) { flash(e, false); e.g.scale.setScalar(1.5); e.vx = e.chargeDir * (P === 3 ? 17 : 14.5); bset(e, "charge", 1.6); sfx.dash?.(); } break;
        case "charge": { e.trailT = (e.trailT || 0) - dt; if (e.trailT <= 0) { e.trailT = .04; ghostTrail(new THREE.Vector3(e.x, e.y + 1, .12), e.face || 1, 0x7A4CFF, 2.8); } const hitW = c.wallAhead(e, Math.sign(e.vx)); e.x += e.vx * dt; if (hitW || e.bt <= 0) { e.vx = 0; addShake(.85, .4); sfx.slam?.(); bset(e, "stun", P === 3 ? .85 : 1.25); } else if (Math.abs(c.player.x - e.x) < 1.5 && Math.abs(c.player.y - e.g.position.y) < 2.2) c.damagePlayer(16, "ТАРАН ГЛИТЧ-МАТЕРИ"); break; }
        case "stun": e.g.rotation.z = Math.sin(e.phase * 22) * .06; if (e.bt <= 0) { e.g.rotation.z = 0; bset(e, "idle", .45); } break;
        case "windburst": flash(e, Math.floor(e.phase * 18) % 2 === 0); if (e.bt <= 0) { flash(e, false); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + e.phase; c.fireOrb(e.x + Math.cos(a) * .6, e.y + 1.1 + Math.sin(a) * .6, Math.cos(a) * 6.5, Math.sin(a) * 6.5, 0xFF2D78, 12, "ГЛИТЧ-ВЕЕР"); } bset(e, "idle", 1.0); } break;
        case "tele": e.g.scale.setScalar(1.5 * (.55 + .45 * Math.abs(Math.sin(e.phase * 26)))); if (e.bt <= 0) { e.g.scale.setScalar(1.5); const side = c.player.x > e.x ? -1 : 1; e.x = c.clampRoom(c.player.x + side * 7); sfx.teleport?.(); bset(e, Math.random() < .55 ? "windbeam" : "windcharge", .45); } break;
      }
      if (e.bstate !== "charge") e.x = Math.max(e.roomX0 + 2, Math.min(e.roomX1 - 2, e.x));
      e.g.position.y = hover; e.y = hover;
      e.face = Math.sign(c.player.x - e.x || 1);
    } },
};
export const BOSS_DROPS_UI = { rain_hunter: "servo", overseer: "wall", press_777: "hack2", brood_mother: "phase" };

export function makeEnemyMesh(typeId, biome, variant) {
  const def = ENEMY_TYPES[typeId] || BOSSES[typeId];
  const p = PAL[biome] || PAL.neon;
  const g = silhouette(def.kind, p, variant || def.variant);
  const fill = healthbar(g, def.h + .5, p.em);
  g.userData.fill = fill; g.userData.etype = typeId;
  return g;
}
