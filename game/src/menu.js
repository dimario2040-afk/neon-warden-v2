// menu.js — SPLASH → TITLE → CREATION → PLAY + pause (Esc) + encyclopedia (Tab)
// Genre best practices: edge-triggered input handled in main.js keydown; this module = state + data + DOM render.

export const menu={
  state:"splash",   // splash | title | creation | play
  paused:false,
  encOpen:false,
  titleIdx:0,
  heroName:"ВАРДЕН",
  lifepath:"street",
  saveExists:false,
};

// discovery (Hunter's Journal style: entries unlock as you play) — persisted via saveGame/loadGame
export const discovery={
  enemies:new Set(),
  npcs:new Set(),
  districts:new Set(),
  wares:new Set(),
  sigils:new Set(),
};

export function menuBlocked(){ return menu.state!=="play" || menu.paused || menu.encOpen; }

export function discoverEnemy(t){ if(t) discovery.enemies.add(t); }
export function discoverNpc(n){ if(n) discovery.npcs.add(n); }
export function discoverDistrict(d){ if(d) discovery.districts.add(d); }
export function discoverWare(w){ if(w) discovery.wares.add(w); }
export function discoverSigil(s){ if(s) discovery.sigils.add(s); }
export function loadDiscovery(d){
  if(!d) return;
  try{
    if(Array.isArray(d.enemies)) d.enemies.forEach(x=>discovery.enemies.add(x));
    if(Array.isArray(d.npcs)) d.npcs.forEach(x=>discovery.npcs.add(x));
    if(Array.isArray(d.districts)) d.districts.forEach(x=>discovery.districts.add(x));
    if(Array.isArray(d.wares)) d.wares.forEach(x=>discovery.wares.add(x));
    if(Array.isArray(d.sigils)) d.sigils.forEach(x=>discovery.sigils.add(x));
    if(d.heroName) menu.heroName=d.heroName;
    if(d.lifepath) menu.lifepath=d.lifepath;
  }catch(e){}
}

// ── ENCYCLOPEDIA (придумана под сеттинг) ──
export const ENCYCLOPEDIA={
  wares:[
    {id:"legs", name:"ДЭШ-НОГИ", key:"K", lore:"Имплант спринтерских мышц корпорации Сеть. Рывок сквозь неон — короткие ярусы больше не помеха. ГДЕ: арена ГРОХОТ, маркет mid (1_1)."},
    {id:"grip", name:"ХВАТ", key:"СПУСК", lore:"Магнитные ладони. Спуск в глубины без страха — шахты открываются, дно не страшно. ГДЕ: арена МОЛЧУН, крипта mid (2_1)."},
    {id:"wings", name:"КРЫЛЬЯ", key:"SPACE×2", lore:"Крыло Икара. Двойной прыжок — небо больше не потолок. ГДЕ: арена ТИНА, затопленка восток (2_2)."},
    {id:"claw", name:"ЦЕП", key:"SPACE у стены", lore:"Магнитный кошачий коготь. Стены ВЕНТИ становятся опорой: wall-jump и slide. ГДЕ: сундук в ВЕНТИ-глубинах (4_2), за territory-2 гейтом 3 сигилов."},
  ],
  characters:[
    {id:"warden", name:"НЕОН-ВАРДЕН", lore:"Страж неонового города. Игла из света, плащ из помех. Последний, кто помнит, как город выглядел при свете."},
    {id:"drone", name:"ДРОН-СКАНЕР", lore:"Слепой глаз корпорации. Летает, сканирует, доносит. Бьет током при контакте.", hp:28},
    {id:"dog", name:"ПЁС-ГРЫЗУН", lore:"Переделанный пес-охранник. Ржавое шасси, оригинальные инстинкты. Быстрый и злой.", hp:28},
    {id:"netrunner", name:"НЕТРАННЕР", lore:"Хакер в балахоне. Стоит и кастует лучи издалека. Антенна выдает замах.", hp:65},
    {id:"ghost", name:"ГОСТ-ЭХО", lore:"Эхо мертвого нетраннера. Полупрозрачный, проходит сквозь плиты.", hp:28},
    {id:"guardian", name:"ГАРДИАН", lore:"Тяжелый страж серверных залов. Туша в броне, удар шестнадцать.", hp:65},
    {id:"glitch", name:"ГЛИТЧ-МАТЬ", boss:true, lore:"Мать всех помех. Телепортируется, зовет детей, плюется лучами. Конец истории.", hp:400},
  ],
  npcs:[
    {id:"scalpel", name:"СКАЛЬПЕЛЬ", lore:"Торговец-хирург. Меняет эдди на здоровье."},
    {id:"boner", name:"КОСТОРЕЗ", lore:"Торговец костяными имплантами. Меняет эдди на урон."},
  ],
  districts:[
    {id:"base", name:"СТИЛЬБА // БАЗА", lore:"Промышленные трущобы. Ржавь, янтарь натрия, кислотные стоки внизу."},
    {id:"market", name:"НЕОН-МАРКЕТ", lore:"Ночной базар. Маджента и циан, влажный камень, арена ГРОХОТ."},
    {id:"crypt", name:"ДАТА-КРИПТА", lore:"Серверные залы. Плиты, тишина, которая слушает. МОЛЧУН."},
    {id:"sunken", name:"ЗАТОПЛЕНКА", lore:"Затопленные глубины. Вода, кислота, ТИНА."},
    {id:"maw", name:"ПАСТЬ", lore:"Пасть ГЛИТЧ-МАТЕРИ. Спуск, финал, конец истории."},
  ],
  sigils:[
    {id:"MK", name:"СИГИЛ ГРОХОТА", from:"арена ГРОХОТ // НЕОН-МАРКЕТ"},
    {id:"CR", name:"СИГИЛ МОЛЧУНА", from:"арена МОЛЧУН // ДАТА-КРИПТА"},
    {id:"SN", name:"СИГИЛ ТИНЫ", from:"арена ТИНА // ЗАТОПЛЕНКА"},
  ],
};

// HK-FEEL PASS — combat techniques section (always visible: it's the control grammar, not a secret)
export const TECHNIQUES=[
  {id:"pogo", name:"ПОГО", key:"S+J в воздухе", lore:"Удар иглой вниз от врага или шипов отбрасывает вардена вверх. Цепочка прыжков сквозь опасность — основа вертикального боя."},
  {id:"focus", name:"ФОКУС", key:"F (удерж.)", lore:"Канал SOUL→HP: 33 RAM за 28 HP за 0.9с. Варден уязвим, движение и урон сбивают канал. RAM добывается ТОЛЬКО ударами иглы (+11 за попадание)."},
  {id:"upslash", name:"ВЕРХОВЫЙ УДАР", key:"W+J", lore:"Размашистый удар иглой вверх — снимает летающих и то, что над головой."},
  {id:"dash", name:"РЫВОК", key:"K", lore:"Короткий dash с кадрами неуязвимости (0.23с) — проходи сквозь атаки, как Сквозной Рывок Хорнет."},
];
export const LIFEPATHS=[
  {id:"street", name:"УЛИЧНЫЙ БОЕЦ", desc:"урон +4", apply:(player)=>{ player.meleeBonus=(player.meleeBonus||0)+4; }},
  {id:"netrunner", name:"НЕТРАННЕР", desc:"хак 18 RAM", apply:(player)=>{ player.hackCost=18; }},
  {id:"stalker", name:"СТАЛКЕР", desc:"HP+25, скорость+", apply:(player)=>{ player.maxHp=(player.maxHp||100)+25; player.hp=player.maxHp; player.speedBonus=0.8; }},
];

// ── DOM render helpers ──
const $=(id)=>document.getElementById(id);

export function showSplash(){
  menu.state="splash";
  if($("splash")) $("splash").style.display="flex";
  if($("title")) $("title").style.display="none";
  if($("creation")) $("creation").style.display="none";
  if($("pause")) $("pause").style.display="none";
  if($("encyclopedia")) $("encyclopedia").style.display="none";
}
export function showTitle(){
  menu.state="title"; menu.paused=false; menu.encOpen=false;
  if($("splash")) $("splash").style.display="none";
  if($("creation")) $("creation").style.display="none";
  if($("pause")) $("pause").style.display="none";
  if($("encyclopedia")) $("encyclopedia").style.display="none";
  if($("title")) $("title").style.display="block";
  renderTitle();
}
export function showCreation(){
  menu.state="creation";
  if($("title")) $("title").style.display="none";
  if($("creation")) $("creation").style.display="flex";
  renderCreation();
  try{ const inp=$("crName"); if(inp){ inp.value=menu.heroName==="ВАРДЕН"?"":menu.heroName; inp.blur(); } }catch(e){}
}
export function showPause(){
  menu.paused=true;
  if($("pause")) $("pause").style.display="flex";
}
export function hidePause(){
  menu.paused=false;
  if($("pause")) $("pause").style.display="none";
}
export function showEnc(){
  menu.encOpen=true;
  if($("encyclopedia")) $("encyclopedia").style.display="flex";
  renderEncyclopedia();
}
export function hideEnc(){
  menu.encOpen=false;
  if($("encyclopedia")) $("encyclopedia").style.display="none";
}
export function toPlay(){
  menu.state="play"; menu.paused=false; menu.encOpen=false;
  if($("splash")) $("splash").style.display="none";
  if($("title")) $("title").style.display="none";
  if($("creation")) $("creation").style.display="none";
  if($("pause")) $("pause").style.display="none";
  if($("encyclopedia")) $("encyclopedia").style.display="none";
}

export const TITLE_ITEMS=[
  {id:"new", label:"НОВАЯ ИГРА"},
  {id:"continue", label:"ПРОДОЛЖИТЬ"},
  {id:"enc", label:"КАРТА МИРА"},
];

export function renderTitle(){
  const box=$("titleItems"); if(!box) return;
  box.innerHTML=TITLE_ITEMS.map((it,i)=>
    `<div class="tItem${i===menu.titleIdx?" sel":""}" data-i="${i}">${it.label}${it.id==="continue"&&!menu.saveExists?" <span class='tDis'>(нет сейва)</span>":""}</div>`
  ).join("");
}

export function renderCreation(){
  const lp=$("crPaths"); if(!lp) return;
  const sel=menu.lifepath;
  lp.innerHTML=LIFEPATHS.map((p,i)=>
    `<div class="crPath${p.id===sel?" sel":""}" data-i="${i}">${i+1} · ${p.name} <span>— ${p.desc}</span></div>`
  ).join("");
}

export function renderEncyclopedia(){
  const body=$("encBody"); if(!body) return;
  const sec=(t)=>`<div class="encSection">${t}</div>`;
  let html="";
  html+=sec("ВАРИ // КИБЕРВАРЬ");
  for(const w of ENCYCLOPEDIA.wares){
    const got=discovery.wares.has(w.id);
    html+=`<div class="encEntry${got?"":" locked"}"><b>${got?w.name:"???"}</b><span class="encKey">${w.key}</span><span class="encLore">${got?w.lore:"Откройте в игре"}</span></div>`;
  }
  html+=sec("ТЕХНИКИ // ГРАММАТИКА БОЯ");
  for(const t of TECHNIQUES){
    html+=`<div class="encEntry"><b>${t.name}</b><span class="encKey">${t.key}</span><span class="encLore">${t.lore}</span></div>`;
  }
  html+=sec("ПЕРСОНАЖИ // ВРАГИ");
  for(const c of ENCYCLOPEDIA.characters){
    const seen=c.id==="warden"||discovery.enemies.has(c.id);
    html+=`<div class="encEntry${seen?"":" locked"}"><b>${seen?c.name:"???"}</b>${c.hp?`<span class="encKey">${c.hp} HP</span>`:""}<span class="encLore">${seen?c.lore:"Победите врага, чтобы открыть"}</span></div>`;
  }
  html+=sec("NPC // ТОРГОВЦЫ");
  for(const n of ENCYCLOPEDIA.npcs){
    const seen=discovery.npcs.has(n.id);
    html+=`<div class="encEntry${seen?"":" locked"}"><b>${seen?n.name:"???"}</b><span class="encLore">${seen?n.lore:"Найдите в городе"}</span></div>`;
  }
  html+=sec("МИР // РАЙОНЫ");
  for(const d of ENCYCLOPEDIA.districts){
    const seen=discovery.districts.has(d.id);
    html+=`<div class="encEntry${seen?"":" locked"}"><b>${seen?d.name:"???"}</b><span class="encLore">${seen?d.lore:"Исследуйте район"}</span></div>`;
  }
  html+=sec("СИГИЛЫ // 3");
  for(const s of ENCYCLOPEDIA.sigils){
    const got=discovery.sigils.has(s.id);
    html+=`<div class="encEntry${got?"":" locked"}"><b>${got?s.name:"???"}</b><span class="encLore">${got?s.from:"???"}</span></div>`;
  }
  body.innerHTML=html;
}
