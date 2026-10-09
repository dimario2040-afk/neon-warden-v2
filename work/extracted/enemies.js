import * as THREE from "three";
import { scene, mergePartsByMaterial } from "./world.js?v=15";
import { burst } from "./fx.js?v=15";
import { enemySpawns, bossSpawn } from "./content.js?v=15";

// ART PASS — authored silhouettes per etype. CONTRACT: userData {core,ring,eye,hb,fill,animTime,etype} 1:1
// core = Mesh w/ emissive material (flash/telegraph swap it), eye = Mesh (telegraph scale), fill = hp bar
export function makeDrone(type=0, etype="drone", variant=""){
  // ART WAVE 2 — boss variants: hammer (ГРОХОТ), silent (МОЛЧУН), water (ТИНА), glitch (ГЛИТЧ-МАТЬ)
  let emissive=0x62f6ff, baseCol=0x16303E, eyeCol=0xffffff;
  if(etype==="ghost"){ emissive=0x9af6ff; baseCol=0x14303E; eyeCol=0xcafffd; }
  else if(etype==="guardian"){ emissive=0x8a5cff; baseCol=0x2A1845; eyeCol=0xffe66d; }
  else if(etype==="skeleton"){ emissive=0xff8c1a; baseCol=0x3A2410; eyeCol=0xffd9a0; }
  else if(etype==="dog"){ emissive=0xffa03a; baseCol=0x3A2A10; eyeCol=0xffe0b0; }
  else if(etype==="netrunner"){ emissive=0xff2e9f; baseCol=0x3A1030; eyeCol=0xffc9e8; }
  else if(etype==="crawler"){ emissive=0xff4a5a; baseCol=0x2A1420; eyeCol=0xff8a9a; }
  else if(type){ emissive=0xff2e9f; baseCol=0x3A1030; eyeCol=0xffffff; }
  const g=new THREE.Group();
  const trim=new THREE.MeshStandardMaterial({color:0x7A8A99,metalness:.85,roughness:.22});
  let core, ring, eye;
  if(etype==="dog"){
    // low quadruped chassis: body + 4 legs + tail antenna + collar ring + forward sensor
    const chassis=new THREE.Mesh(new THREE.BoxGeometry(.78,.30,.42),new THREE.MeshStandardMaterial({color:baseCol,emissive,emissiveIntensity:3.2,metalness:.78,roughness:.22}));
    chassis.position.y=.30;g.add(chassis);core=chassis;
    for(const [lx,lz] of [[-.26,-.14],[.26,-.14],[-.26,.14],[.26,.14]]){
      const leg=new THREE.Mesh(new THREE.BoxGeometry(.08,.30,.08),trim);leg.position.set(lx,.10,lz);g.add(leg);
    }
    const tail=new THREE.Mesh(new THREE.BoxGeometry(.05,.30,.05),trim);tail.position.set(-.42,.50,0);tail.rotation.z=.5;g.add(tail);
    ring=new THREE.Mesh(new THREE.TorusGeometry(.22,.03,6,14),new THREE.MeshStandardMaterial({color:baseCol,emissive,emissiveIntensity:2.2,metalness:.8,roughness:.2}));
    ring.rotation.x=Math.PI/2;ring.position.y=.52;g.add(ring);
    eye=new THREE.Mesh(new THREE.SphereGeometry(.10,10,8),new THREE.MeshBasicMaterial({color:eyeCol}));eye.position.set(.42,.36,0);eye.scale.y=.6;g.add(eye);
  } else if(etype==="netrunner"){
    // hooded caster: robe + hood + floating orb + antenna (tip = eye, telegraph pulses it)
    const robe=new THREE.Mesh(new THREE.ConeGeometry(.42,1.5,6,1,true),new THREE.MeshStandardMaterial({color:baseCol,emissive,emissiveIntensity:1.6,metalness:.5,roughness:.32,side:THREE.DoubleSide,transparent:true,opacity:.94}));
    robe.position.y=.75;g.add(robe);core=robe;
    const hood=new THREE.Mesh(new THREE.SphereGeometry(.24,12,8),new THREE.MeshStandardMaterial({color:baseCol,emissive,emissiveIntensity:2.4,metalness:.4,roughness:.4}));
    hood.position.y=1.58;g.add(hood);
    const orb=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),new THREE.MeshStandardMaterial({color:baseCol,emissive,emissiveIntensity:4.5}));orb.toneMapped=false;
    orb.position.set(.34,1.05,.14);g.add(orb);
    ring=new THREE.Mesh(new THREE.TorusGeometry(.30,.03,6,16),new THREE.MeshStandardMaterial({color:baseCol,emissive,emissiveIntensity:2.0,transparent:true,opacity:.6}));
    ring.rotation.x=Math.PI/2;ring.position.y=1.58;g.add(ring);
    const ant=new THREE.Mesh(new THREE.BoxGeometry(.03,.5,.03),trim);ant.position.set(0,1.9,0);g.add(ant);
    eye=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),new THREE.MeshBasicMaterial({color:eyeCol}));eye.position.set(0,2.16,0);g.add(eye);
  } else if(etype==="ghost"){
    // translucent wisp: additive core + trailing veil + faint outer ring
    // silent variant (МОЛЧУН): narrow wisp + 2 long thin reaching arms
    const wispR = variant==="silent"? .30 : .42;
    const wisp=new THREE.Mesh(new THREE.SphereGeometry(wispR,12,10),new THREE.MeshStandardMaterial({color:baseCol,emissive,emissiveIntensity:3.4,transparent:true,opacity:.45,depthWrite:false}));
    wisp.position.y=.85;g.add(wisp);core=wisp;
    const trail=new THREE.Mesh(new THREE.ConeGeometry(variant==="silent"? .2:.30,.9,6,1,true),new THREE.MeshStandardMaterial({color:baseCol,emissive,emissiveIntensity:2.0,transparent:true,opacity:.30,side:THREE.DoubleSide,depthWrite:false}));
    trail.position.y=.15;trail.rotation.x=Math.PI;g.add(trail);
    if(variant==="silent"){
      for(const sx of [-.4,.44]){
        const arm=new THREE.Mesh(new THREE.BoxGeometry(.05,1.7,.05),trim);arm.position.set(sx,.55,0);g.add(arm);
      }
    }
    ring=new THREE.Mesh(new THREE.TorusGeometry(.5,.025,6,20),new THREE.MeshStandardMaterial({color:baseCol,emissive,emissiveIntensity:1.6,transparent:true,opacity:.5}));
    ring.rotation.x=Math.PI/2;ring.position.y=.85;g.add(ring);
    eye=new THREE.Mesh(new THREE.SphereGeometry(.10,8,6),new THREE.MeshBasicMaterial({color:eyeCol}));eye.position.set(.12,1.0,.34);g.add(eye);
  } else if(etype==="crawler"){
    // ВЕНТИ: spider-like wall crawler — low body + 6 legs + red sensor
    const body=new THREE.Mesh(new THREE.SphereGeometry(.34,10,8),new THREE.MeshStandardMaterial({color:baseCol,emissive,emissiveIntensity:3.2,metalness:.75,roughness:.25}));
    body.position.y=.34;g.add(body);core=body;
    for(let i=0;i<6;i++){
      const ang=(i/6)*Math.PI*2;
      const leg=new THREE.Mesh(new THREE.BoxGeometry(.05,.4,.05),trim);
      leg.position.set(Math.cos(ang)*.4,.18,Math.sin(ang)*.3);
      leg.rotation.z=Math.cos(ang)*.7;g.add(leg);
    }
    ring=new THREE.Mesh(new THREE.TorusGeometry(.24,.025,6,14),new THREE.MeshStandardMaterial({color:baseCol,emissive,emissiveIntensity:2.0,metalness:.8,roughness:.2}));
    ring.rotation.x=Math.PI/2;ring.position.y=.4;g.add(ring);
    eye=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),new THREE.MeshBasicMaterial({color:0xff4a5a}));eye.position.set(0,.42,.3);g.add(eye);
  } else if(etype==="guardian"){
    // ART WAVE 2 — variant visuals: hammer (ГРОХОТ), silent (МОЛЧУН), water (ТИНА)
    if(variant==="water"){
      // водяная форма: blob-сферы, translucent зелено-циан, капли
      const blobMat=new THREE.MeshStandardMaterial({color:0x1A3A2A,emissive:0x39FF14,emissiveIntensity:2.4,transparent:true,opacity:.6,roughness:.18});
      const blob=new THREE.Mesh(new THREE.SphereGeometry(.72,14,10),blobMat);blob.position.y=.85;g.add(blob);core=blob;
      const blob2=new THREE.Mesh(new THREE.SphereGeometry(.4,10,8),blobMat);blob2.position.set(-.42,.5,.1);g.add(blob2);
      const blob3=new THREE.Mesh(new THREE.SphereGeometry(.34,10,8),blobMat);blob3.position.set(.44,.62,-.08);g.add(blob3);
      for(const dx of [-.3,.3]){
        const drip=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),blobMat);drip.position.set(dx,-.12,.15);g.add(drip);
      }
      ring=new THREE.Mesh(new THREE.TorusGeometry(.8,.04,8,20),new THREE.MeshStandardMaterial({color:0x1A3A2A,emissive:0x39FF14,emissiveIntensity:1.8,transparent:true,opacity:.5}));
      ring.rotation.x=Math.PI/2;ring.position.y=1.6;g.add(ring);
      eye=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),new THREE.MeshBasicMaterial({color:0xEAFFE0}));eye.position.set(0,1.0,.6);eye.scale.y=.6;g.add(eye);
    } else {
      // armored hull (narrow for МОЛЧУН) + arms by variant + visor slit
      const narrow = variant==="silent"? .62 : .85;
      const hull=new THREE.Mesh(new THREE.BoxGeometry(narrow,.95,.55),new THREE.MeshStandardMaterial({color:baseCol,emissive,emissiveIntensity:3.0,metalness:.82,roughness:.2}));
      hull.position.y=.95;g.add(hull);core=hull;
      if(variant==="hammer"){
        // ГРОХОТ: массивная рука-молот
        const harm=new THREE.Mesh(new THREE.BoxGeometry(.32,1.15,.3),trim);harm.position.set(-.78,.75,0);g.add(harm);
        const hhead=new THREE.Mesh(new THREE.BoxGeometry(.62,.44,.44),new THREE.MeshStandardMaterial({color:baseCol,emissive,emissiveIntensity:3.6,metalness:.85,roughness:.18}));
        hhead.position.set(-.78,1.42,0);g.add(hhead);
        const armR2=new THREE.Mesh(new THREE.BoxGeometry(.2,.8,.24),trim);armR2.position.set(.66,.72,0);g.add(armR2);
      } else if(variant==="fan"){
        // ВЫХЛОП: турбина-вентилятор — большой диск + лопасти
        const disc=new THREE.Mesh(new THREE.CylinderGeometry(.9,.9,.3,14),new THREE.MeshStandardMaterial({color:baseCol,emissive,emissiveIntensity:2.6,metalness:.7,roughness:.3}));
        disc.rotation.x=Math.PI/2;disc.position.y=1.0;g.add(disc);core=disc;
        for(let i=0;i<4;i++){
          const bl=new THREE.Mesh(new THREE.BoxGeometry(.16,.8,.06),trim);bl.position.y=1.0;bl.rotation.z=i*Math.PI/2+Math.PI/4;g.add(bl);
        }
      } else if(variant==="silent"){
        // МОЛЧУН: два длинных тонких руки-щупальца
        for(const sx of [-.42,.5]){
          const arm=new THREE.Mesh(new THREE.BoxGeometry(.07,2.3,.07),trim);arm.position.set(sx,1.35,0);g.add(arm);
        }
      } else {
        for(const sx of [-.62,.62]){
          const arm=new THREE.Mesh(new THREE.BoxGeometry(.22,.85,.26),trim);arm.position.set(sx,.75,0);g.add(arm);
        }
      }
      ring=new THREE.Mesh(new THREE.TorusGeometry(.78,.05,8,20),new THREE.MeshStandardMaterial({color:baseCol,emissive,emissiveIntensity:2.2,metalness:.8,roughness:.2}));
      ring.rotation.x=Math.PI/2;ring.position.y=1.55;g.add(ring);
      eye=new THREE.Mesh(new THREE.BoxGeometry(.4,.08,.06),new THREE.MeshBasicMaterial({color:eyeCol}));eye.position.set(0,1.15,narrow/2+.02);g.add(eye);
      if(variant==="glitch"){
        // ГЛИТЧ-МАТЬ: глитч-плоскости вокруг корпуса
        const gm=new THREE.MeshBasicMaterial({color:0x39FF14,transparent:true,opacity:.3,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
        for(const [gx,gy,gw] of [[-.6,1.2,.06],[.62,.85,.06],[0,1.55,.5]]){
          const gp=new THREE.Mesh(new THREE.PlaneGeometry(gw>.1? .7:.24, .16),gm);
          gp.position.set(gx,gy,.36);g.add(gp);
        }
      }
    }
  } else {
    // quad-rotor drone (default + heavy type 1): icosa core + rotor ring + 4 arms w/ rotor discs + scanner eye
    const icosa=new THREE.Mesh(new THREE.IcosahedronGeometry(type?.62:.48,1),new THREE.MeshStandardMaterial({color:baseCol,emissive,emissiveIntensity:4,metalness:.85,roughness:.18}));
    g.add(icosa);core=icosa;
    ring=new THREE.Mesh(new THREE.TorusGeometry(type?.86:.68,.045,8,20),new THREE.MeshStandardMaterial({color:type?0x5d123e:0x174b59,emissive,emissiveIntensity:2.2,metalness:.8,roughness:.2}));
    ring.rotation.x=Math.PI/2;g.add(ring);
    const armLen=type?1.15:.9;
    for(let i=0;i<4;i++){
      const arm=new THREE.Mesh(new THREE.BoxGeometry(.07,armLen,.07),trim);arm.rotation.z=i*Math.PI/2;arm.position.y=.1;g.add(arm);
      const rotor=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.02,10),new THREE.MeshStandardMaterial({color:type?0x5d123e:0x174b59,emissive,emissiveIntensity:1.8,transparent:true,opacity:.55}));
      rotor.position.set(Math.cos(i*Math.PI/2)*armLen*.5,.16,Math.sin(i*Math.PI/2)*armLen*.5);g.add(rotor);
    }
    eye=new THREE.Mesh(new THREE.SphereGeometry(type?.16:.11,10,8),new THREE.MeshBasicMaterial({color:eyeCol}));eye.position.z=.48;eye.scale.y=.55;g.add(eye);
  }
  // PERF PASS — fold static hull parts (legs/arms/antennae/hulls/rotor-arms) into per-material
  // meshes. Animated parts (core/ring/eye) stay separate — the userData contract is untouched.
  try{
    const referenced=new Set([core,ring,eye]);
    const cand=g.children.filter(c=>c.isMesh&&!referenced.has(c)&&c.children.length===0);
    if(cand.length>=2){
      for(const part of mergePartsByMaterial(cand)){
        for(const src of part.sources) g.remove(src);
        g.add(part.mesh);
      }
    }
  }catch(e){}
  // healthbar (fill scale.x = hp/max)
  const hbY = etype==="dog"? .95 : etype==="netrunner"? 2.35 : etype==="guardian"? 1.85 : etype==="ghost"? 1.5 : (type?1.28:1.0);
  const hb=new THREE.Group();hb.position.set(0,hbY,.05);
  const back=new THREE.Mesh(new THREE.PlaneGeometry(type?1.7:1.25,.11),new THREE.MeshBasicMaterial({color:0x120b16,transparent:true,opacity:.9}));
  const fill=new THREE.Mesh(new THREE.PlaneGeometry(type?1.62:1.17,.07),new THREE.MeshBasicMaterial({color:emissive}));fill.position.z=.01;
  hb.add(back,fill);g.add(hb);
  g.userData={core,ring,eye,hb,fill,animTime:Math.random()*6,etype};
  return g;
}
export const enemies=[];export function spawnEnemy(x,y,type=0,etype="drone",variant=""){
  // ghost 28hp fast, guardian 65hp tanky 16 contact, skeleton 28hp, netrunner 65hp heavy
  let hp=28,max=28;
  if(etype==="guardian") { hp=65; max=65; type=1; }
  else if(etype==="ghost") { hp=28; max=28; type=0; }
  else if(etype==="crawler") { hp=22; max=22; type=0; }
  else { hp=type?65:28; max=hp; }
  let e={g:makeDrone(type,etype,variant),x,y,vx:0,vy:0,anchorY:y,hp,max,type,attack:0,hit:0,dead:false,phase:0,shot:0,etype,variant, flashT:0, telegraphT:0, telegraphDmg:0, telegraphSrc:"", baseEmissive:null, baseIntensity:0};
  e.col=Math.max(0,Math.min(9,Math.floor((x+33)/48))); // WAVE 0: level tag by col
  e.g.position.set(x,y,0);scene.add(e.g);enemies.push(e);return e
}
for(const sp of enemySpawns){ const x=sp[0], y=sp[1], t=sp[2], et=sp[3]||"drone"; spawnEnemy(x,y,t,et); }
export const boss=spawnEnemy(bossSpawn[0],bossSpawn[1],bossSpawn[2], bossSpawn[3]||"guardian", "glitch");boss.hp=300;boss.max=300;boss.g.scale.setScalar(1.65);boss.isBoss=true; boss.etype="guardian"; boss.isGlitchMother=true;
// phase crown for final boss (static emissive ring above)
{ try{
  const crown=new THREE.Mesh(new THREE.TorusGeometry(.55,.05,6,18),new THREE.MeshStandardMaterial({color:0x2A2200,emissive:0xFFD700,emissiveIntensity:3.4}));
  crown.toneMapped=false; crown.rotation.x=Math.PI/2; crown.position.y=2.3; boss.g.add(crown);
}catch(e){} }
