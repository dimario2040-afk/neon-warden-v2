import * as THREE from "three";
import { scene, camera } from "./world.js?v=15";
import { burst, beam, impactRing } from "./fx.js?v=15";
import { sfx } from "./audio.js?v=15";

function limb(mat,w,h,d){return new THREE.Mesh(new THREE.CapsuleGeometry(w,h,4,8),mat)}

// ART PASS — authored warden silhouette. CONTRACT: userData keys {head,torso,legL,legR,armL,armR,blade,cloak,animTime} 1:1
// (main.js rig animation drives rotation on these; renaming breaks animation)
export function makePlayer(){
  const g=new THREE.Group();
  const suit=new THREE.MeshStandardMaterial({color:0x9AA7B8,roughness:.5,metalness:.35,emissive:0x0a1a2a,emissiveIntensity:1.2});
  const plate=new THREE.MeshStandardMaterial({color:0xBCC9D9,roughness:.32,metalness:.6,emissive:0x0e2236,emissiveIntensity:1.8});
  const jointMat=new THREE.MeshStandardMaterial({color:0x0a111b,roughness:.45,metalness:.65,emissive:0x061722,emissiveIntensity:1});
  const glow=new THREE.MeshStandardMaterial({color:0x061d25,emissive:0x62f6ff,emissiveIntensity:7});glow.toneMapped=false;
  const bladeCoreMat=new THREE.MeshStandardMaterial({color:0xEAFBFF,emissive:0xBFF6FF,emissiveIntensity:9});bladeCoreMat.toneMapped=false;
  const bladeGlowMat=new THREE.MeshStandardMaterial({color:0x0A2A38,emissive:0x62f6ff,emissiveIntensity:3.0,transparent:true,opacity:.4});bladeGlowMat.toneMapped=false;bladeGlowMat.blending=THREE.AdditiveBlending;bladeGlowMat.depthWrite=false;
  // head: helmet skull + jaw guard + crest fin
  const head=new THREE.Group();
  const skull=new THREE.Mesh(new THREE.SphereGeometry(.40,16,12),suit);head.add(skull);
  const jaw=new THREE.Mesh(new THREE.BoxGeometry(.34,.16,.30),jointMat);jaw.position.set(0,-.28,.06);head.add(jaw);
  const crest=new THREE.Mesh(new THREE.BoxGeometry(.06,.30,.40),plate);crest.position.set(0,.36,-.04);head.add(crest);
  head.position.y=1.75;g.add(head);
  // visor slit (glow bar)
  const visor=new THREE.Mesh(new THREE.BoxGeometry(.46,.09,.16),glow);visor.position.set(.15,1.85,.34);visor.rotation.z=-.08;g.add(visor);
  // torso group: chest plate + power core + abdomen + belt
  const torso=new THREE.Group();
  const chest=new THREE.Mesh(new THREE.BoxGeometry(.68,.60,.42),plate);chest.position.y=.28;torso.add(chest);
  const chestCore=new THREE.Mesh(new THREE.BoxGeometry(.18,.22,.06),glow);chestCore.position.set(0,.28,.23);torso.add(chestCore);
  const abdomen=new THREE.Mesh(new THREE.CapsuleGeometry(.30,.30,4,8),suit);abdomen.position.y=-.24;torso.add(abdomen);
  const belt=new THREE.Mesh(new THREE.BoxGeometry(.52,.10,.38),jointMat);belt.position.y=-.46;torso.add(belt);
  torso.position.y=.98;g.add(torso);
  // limbs (joint material, dark) + boots
  const legL=limb(jointMat,.14,.68,.14);legL.position.set(-.24,.1,0);g.add(legL);
  const legR=limb(jointMat,.14,.68,.14);legR.position.set(.24,.1,0);g.add(legR);
  const bootL=new THREE.Mesh(new THREE.BoxGeometry(.19,.12,.28),plate);bootL.position.set(0,-.44,.05);legL.add(bootL);
  const bootR=new THREE.Mesh(new THREE.BoxGeometry(.19,.12,.28),plate);bootR.position.set(0,-.44,.05);legR.add(bootR);
  const armL=limb(jointMat,.13,.62,.13);armL.position.set(-.56,1.06,0);armL.rotation.z=-.25;g.add(armL);
  const armR=limb(jointMat,.13,.62,.13);armR.position.set(.56,1.06,0);armR.rotation.z=.25;g.add(armR);
  // pauldrons ride the arms (follow swing)
  const padL=new THREE.Mesh(new THREE.BoxGeometry(.30,.18,.36),plate);padL.position.set(0,.34,0);armL.add(padL);
  const padR=new THREE.Mesh(new THREE.BoxGeometry(.30,.18,.36),plate);padR.position.set(0,.34,0);armR.add(padR);
  // energy needle parented to the sword hand (rigging best practice: weapon → hand bone, grip at hilt,
  // needle base sits at the grip so the character holds the hilt, not the blade)
  const blade=new THREE.Group();
  const bCore=new THREE.Mesh(new THREE.CylinderGeometry(.008,.10,1.35,6),bladeCoreMat);bCore.position.y=.675;blade.add(bCore);
  const bGlow=new THREE.Mesh(new THREE.CylinderGeometry(.05,.17,1.52,6),bladeGlowMat);bGlow.position.y=.76;blade.add(bGlow);
  const hilt=new THREE.Mesh(new THREE.BoxGeometry(.12,.22,.12),jointMat);blade.add(hilt);
  blade.position.set(0,.44,.05);blade.rotation.z=-.3;armR.add(blade);
  // tattered cloak: main cape + 2 tail segments (Group — rig.cloak.rotation drives all)
  const cloakMat=new THREE.MeshStandardMaterial({color:0x071018,emissive:0x1a2a4a,emissiveIntensity:2.2,side:THREE.DoubleSide,transparent:true,opacity:.88});
  const cloak=new THREE.Group();
  const cape=new THREE.Mesh(new THREE.ConeGeometry(.62,1.05,5,1,true),cloakMat);cloak.add(cape);
  const tail1=new THREE.Mesh(new THREE.ConeGeometry(.26,.62,4,1,true),cloakMat);tail1.position.set(-.20,-.72,.05);tail1.rotation.z=.14;cloak.add(tail1);
  const tail2=new THREE.Mesh(new THREE.ConeGeometry(.26,.55,4,1,true),cloakMat);tail2.position.set(.18,-.66,-.05);tail2.rotation.z=-.12;cloak.add(tail2);
  cloak.position.set(-.18,.78,-.18);cloak.rotation.x=Math.PI;g.add(cloak);
  // cyan halo sprite (radial canvas glow)
  try{
    const c=document.createElement('canvas');c.width=64;c.height=64;
    const ctx=c.getContext('2d');
    const grd=ctx.createRadialGradient(32,32,4,32,32,32);
    grd.addColorStop(0,'rgba(0,245,255,0.55)');grd.addColorStop(0.5,'rgba(0,245,255,0.18)');grd.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=grd;ctx.fillRect(0,0,64,64);
    const tex=new THREE.CanvasTexture(c);
    const haloMat=new THREE.SpriteMaterial({map:tex,transparent:true,opacity:0.55,depthWrite:false,blending:THREE.AdditiveBlending});
    const halo=new THREE.Sprite(haloMat);halo.position.set(0.15,1.82,0.38);halo.scale.set(0.9,0.9,1);g.add(halo);
  }catch(e){}
  g.userData={head,torso,legL,legR,armL,armR,blade,cloak,animTime:0};
  return g;
}
export const player={g:makePlayer(),x:-24,y:1.1,vx:0,vy:0,face:1,hp:100,maxHp:100,meleeBonus:0,ram:100,ground:false,coyote:0,jbuf:0,attack:0,attackCd:0,attackFx:0,dash:0,dashCd:0,inv:0,hack:0,prevY:1.1,hasLegs:false,hasGrip:false,hasWings:false,hasWon:false,hasClaw:false,wallSliding:false,doubleJumpUsed:false,onLadder:false, climbing:false, climbSpeed:4, dropT:0,
  // HK-FEEL PASS — directional nail + focus (SOUL→HP channel)
  attackDir:"side", attackDur:0.28, focusing:false, focusT:0, soulFlash:0};
scene.add(player.g);

// HK-FEEL PASS — combat tuning constants (single source of truth for balance)
export const ATK_DUR=0.28, ATK_CD=0.34;      // snappy HK nail cadence (was .30/.38)
export const DASH_DUR=0.18, DASH_CD=0.55, DASH_IFRAME=0.23; // was cd .75
export const FOCUS_COST=33, FOCUS_HEAL=28, FOCUS_TIME=0.9;  // HK soul math: 3 hits ≈ 1 heal
export const SOUL_PER_HIT=11, SOUL_PER_KILL=6;
export const HACK_DMG=30;                     // was 34; cost default 33 (was 25) — competes with FOCUS

export function attack(dir="side"){
  if(player.attackCd>0||player.dash>0||player.attack>0)return;
  // attacking cancels focus channel (HK: nail swing interrupts healing)
  if(player.focusing){ player.focusing=false; player.focusT=0; }
  player.attack=ATK_DUR;player.attackCd=ATK_CD;player.attackDir=dir;player.attackId=(player.attackId||0)+1;
  if(dir==="up"){
    burst(new THREE.Vector3(player.x+player.face*.5,player.y+2.1,0),0x62f6ff,12,.065); sfx.upswing();
  } else if(dir==="down"){
    burst(new THREE.Vector3(player.x+player.face*.5,player.y-0.2,0),0x62f6ff,12,.065); sfx.upswing();
    if(!player.ground) player.vy*=0.55; // slight hover commitment, HK down-slash weight
  } else {
    player.vx+=player.face*3.0; // subtle HK lunge into the sweep (was +6 in keydown — too floaty)
    burst(new THREE.Vector3(player.x+player.face*.9,player.y+1,0),0x62f6ff,12,.065); sfx.swing();
  }
}
export function dash(){
  if(player.dashCd>0||player.dash>0)return;
  if(player.focusing){ player.focusing=false; player.focusT=0; }
  player.dash=DASH_DUR;player.dashCd=DASH_CD;player.inv=Math.max(player.inv,DASH_IFRAME);
  player.vx=player.face*18;
  burst(player.g.position,0x9d6cff,12,.045); sfx.dash();
}
export function hack(enemies, kill, message){
  const hc=player.hackCost||FOCUS_COST;
  if(player.hack>0) return;
  if(player.focusing){ player.focusing=false; player.focusT=0; }
  if(player.ram<hc){
    message("LOW RAM");
    try{
      const ramEl=document.getElementById("ram");
      const pill=ramEl? ramEl.parentElement : null;
      if(pill){
        pill.classList.remove("ram-shake");
        void pill.offsetWidth;
        pill.classList.add("ram-shake");
        setTimeout(()=>pill.classList.remove("ram-shake"), 380);
      }
    }catch(e){}
    return;
  }
  let best=null,bd=9;
  for(const e of enemies){if(e.dead)continue;let dx=e.x-player.x;if(dx*player.face<-.5)continue;let d=Math.abs(dx)+(Math.abs(e.y-player.y)*.5);if(d<bd){bd=d;best=e}}
  if(!best){message("NO TARGET");return}
  player.ram-=hc;player.hack=.35; sfx.hack();
  beam(new THREE.Vector3(player.x,player.y+1,0),new THREE.Vector3(best.x,best.y+1,0),0x9d6cff);
  // ART PASS — shot feel: muzzle flash + recoil kick + impact ring at target
  burst(new THREE.Vector3(player.x+player.face*.5,player.y+1.05,.2),0xC9A8FF,6,.045);
  player.vx-=player.face*2.5;
  impactRing(new THREE.Vector3(best.x,best.y+1,0),0x9d6cff);
  best.hp-=HACK_DMG;best.hit=.25;best.vx=(best.x>=player.x?1:-1)*8;
  burst(new THREE.Vector3(best.x,best.y+1,0),0x9d6cff,16,.06);
  // damage number at target
  try{
    const el=document.createElement("div");
    el.className="dmgpop";
    el.textContent="-"+HACK_DMG+" HACK";
    el.style.color="#C9A8FF";
    el.style.textShadow="0 0 10px #9d6cff, 0 2px 6px rgba(0,0,0,.7)";
    const v=new THREE.Vector3(best.x,best.y+1,0);
    v.project(camera);
    el.style.left=((v.x*.5+.5)*innerWidth)+"px";
    el.style.top=((-v.y*.5+.5)*innerHeight)+"px";
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),700);
  }catch(e){}
  if(best.hp<=0) kill(best);
}
export function getHackTarget(enemies){
  let best=null,bd=9;
  for(const e of enemies){if(e.dead)continue;let dx=e.x-player.x;if(dx*player.face<-.5)continue;let d=Math.abs(dx)+(Math.abs(e.y-player.y)*.5);if(d<bd){bd=d;best=e}}
  return best;
}
