# SUMMARY — выжимка диалога и текущее состояние проекта (NEON WARDEN 2)

Дата среза: 2026-10-09 · Репозиторий: `/home/user/game` (git, commit `59796bf` + коммит summary) ·
Артефакты: `dist/neon-warden_V2.html` (single-file игра), `/home/user/neon-warden-v2-github.zip` (для GitHub).

## 1. Что было на входе
`uploads/neon-warden_V1921.html` (v4.1.21): single-file HTML5+Three.js r165 прототип «cybervania» сblob-loader'ом
(13 ES-модулей в JSON). Зрелые: fixed-step цикл с watchdog, HK-feel глаголы (nail 3 напр / dash i-frames / pogo /
focus SOUL→HP / hack), eco-лестница для software-GL, меню/creation/encyclopedia, WebAudio-синтез. Сырые: уровень-слой
(непрерывная сетка 10×3 экранов, формульные платформы, линейные LEVELS-подгрузки), враги (однородные lerp-ИИ),
миникарта-спойлер, чекпоинты «где встал». Аудит: `docs/AUDIT.md`.

## 2. Хронология раундов
- **R1–2 (метроидвания)**: уровень-слой заменён на data-driven граф комнат Metroid-NES: `rooms.js` (38 комнат, 6 биомов),
  `worldgraph.js` (BFS-прогрессия, валидаторы), `levelbuild.js` (компилятор комнат, merge-меши), `mapui.js` (карта с туманом),
  `enemydefs.js` (13 архетипов: 7 геометр./таймерных + 6 реактивных + boss-kit 7 боссов), `main.js` rewrite (AABB-физика,
  двери/гейты/замки/лифты, сейв-терминалы, save v2), `debugx.js` (F1–F6, `__DBG`). Прогрессия: servo→wall/hack2→phase→cores3→финал.
- **R3 (баг «смерть при выходе вверх»)**: doorSpawnPoint S-ветки добавлял origin дважды → спавн за kill-plane; фикс + спавн на
  кромку вне зоны; push-back S-дверей на кромку; регресс-тест в playtest.
- **R4 (баг «пропали порталы вниз»)**: периметральный пол удалён (полы = данные комнат, иначе «подпол»-карманы и скрытое дно
  под кислотой); вырезы полов под S-люки в m1/m2; верхние полки m1/s3 подняты под сжатую N-зону; S-зона = вся ширина проёма;
  новый `tests/portal_audit.mjs` (все двери всех комнат подходом «как игрок», lock-стороны, лифт).
- **R5 (баг «застревания на верхних полках под люком»)**: норматив люка зафиксирован: проём ±2.0 (HATCH_HALF), верхняя полка
  T ∈ [h−2.95, h−2.8] (доставка в зону ≤2.6 И зазор головы ≥0.9); все 18 N-комнат приведены к T=19.2; velocity-guard дверей
  (N vy>1, S vy<−1, E/W |vx|>0.5) + knockT (нокбэк не закидывает в двери); i-frames 1.0 c на прибытие; тест манёвра с полки.
- **R6 (ПРЕСС-777 «невнятный»)**: босс переписан по HK-грамматике: ганtry-пресс на потолочной рейке: track→aim(лок+маркер-
  колонна+magenta-полоса)→slam(узкая колонна, 22 dmg один раз)→impact(волны по полу)→каждая 3-я серия→overheat(вент раскрыт =
  punish)→rise; фаза 2 <50%; contact:false, урон только явный; `tests/boss_press.mjs`.
- **R6b (best-practices по врагам/коллизиям)**: видимый скан-луч турели, кольцо-пульс джаммера, edge-turn патролей (Metroid),
  isFlyE из def.fly, контактный хитбокс ×0.85, auto-hack sec-дверей, step-up assist ≤0.35u.
- **R7 (карта/прогрессия UX)**: подписи гейтов на карте, блок ЦЕЛИ (progressionGoals), HUD-пиллы способностей, gateMsg с
  источником («ГДЕ ВЗЯТЬ»), барьер p4 объясняется при упоре; creation_look-тест.
- **R8 (visual/UX баги)**: возвращён потерянный `updateFx(dt)` (следы взмахов/dash «запекались»); parallax-баг: биом-группы
  вложены в носители слоёв + vertical-follow (k .98/.96/.93), Y0=−14; emissive силуэтов усилен; `__DBG.showParallax()`.
- **R9 (creation-ввод, bloom-читаемость, жёсткий мир, модели врагов)**: creation = 2 режима (ПУТЬ: 1/2/3,W/S; TAB→ИМЯ), клики,
  #crHint; setLookQuality (exp 1.34, hemi 1.75, key 2.1, bloom 0.65), hardware стартует в quality; «жёсткий мир»: thin-полки
  стали сплошными + push-out летающих + wall-slide только по толстым; ~34 полки подняты (норматив головы ≥2.05 над дорожками);
  rig-части врагов (userData.parts) + процедурные анимации (ноги, челюсть, крылья, голова-прицел, щит, пружины, когти, отдача,
  тарелка, орбы); squash/landing, шлейфы dash-атак боссов, ragdoll-осколки трупов (spawnDebris/updateDebris).
- **R10 (баг «нельзя встать между платформами», pu5 со скрина)**: ПРАВИЛО РОСТА в phys (свободный интервал ≥1.2u над площадкой
  стойки, нависание = низ в [T+0.3, T+2.1); коридоры дверей ≥1.0); 8 комнат исправлены сдвигом полок; LAUNCH-WINDOW правило
  (окно разбега ≥2.0u вне проекции верхней полки при перекрытии, step ≤2.75 base/≤4.3 servo); n9 пересобран (пол 3.4, цепь с
  окнами 4–8u); `tests/n9_climb.mjs` (base-бот вылезает из n9).
- **R11 (баг «с base не запрыгивается на цепи», n3 со скрин)**: corner-correction 0.55u (Celeste) на кромках сплошных; боты на
  держанный прыжок (variable jump: тап 1.95 / держание 2.9 — фича); n5 пересобрана клоном цепи n3; **проектное решение**: сплошные =
  support-геометрия (стены/полы/ямы/муверы/барьеры), полки цепей = one-way с точной посадкой (доказано: полностью сплошные полки
  делают base-подъёмы невозможными — bonk головой в полку на +2 уровня, окна разбева вырождаются); phys упрощён под one-way
  (норматив люка, S-отверстия, муверы сохранены); `tests/climb_base.mjs` (n3+n5, 8 ступеней + люк, без способностей) PASS.
- **R12 (упаковка)**: локальный git-репо (init, .gitignore/.gitattributes, commit, tag v2.0); zip-артефакт для ручной загрузки
  на GitHub (лицензия: отсутствует по решению пользователя).

## 3. Текущая архитектура (ключевые модули)
| Модуль | Роль |
|---|---|
| src/rooms.js | ДАННЫЕ: 38 комнат (solids/oneway/doors+gate+lock/hazards/movers/lifts/ladders/conveyors/winds/pins/cracks/secdoors/barriers/enemies/items/boss/props/map[mx,my]) |
| src/worldgraph.js | граф, BFS-прогрессия, hasFlag, deadEnd/mapConsistency-аудит (чистый, node-тестируемый) |
| src/biomes.js | паспорта 6 биомов: fog/light/mats/parallax-рецепт+midExtra/mood/uiAccent |
| src/levelbuild.js | компилятор комнат: коллайдеры (perimeter без пола), merge-меши 4/комната, doorZone (HATCH_HALF=2.0, S=вся ширина проёма), неон-дефы |
| src/enemydefs.js | ENEMY_TYPES (13) + BOSSES (7) + silhouette-конструктор с parts-rig |
| src/world.js | сцена/рендер/свет/setBiomeMood/parallax-носители с vertical-follow/chunk-стриминг/setLookQuality |
| src/main.js | цикл 60Гц fixed-step, AABB-физика (resolveX/Y, corner-correction, step-up, drop-through), переходы/гейты/замки/лифты, бой, сейвы, HUD, eco-present, `__GAME__`/`__DBG` |
| src/player.js | меш вардена + глаголы (attack 3 напр/dash/hack/focus), feel-константы, ab{servo,wall,phase,hack2} |
| src/mapui.js / debugx.js | карта+миникарта / F1–F6 оверлеи + __DBG API |
| src/audio|fx|postfx|menu.js | унаследованы от v1 (moods, particles, bloom, меню) |

## 4. Нормативы и инварианты (зафиксированы в тестах/README)
- Люк N: проём ±2.0u; верхняя полка T ∈ [h−2.95, h−2.8] (для h=22 → 19.05…19.2); jump-through требует vy>1.
- S-зона = вся ширина проёма пола; спавн при подъёме — на кромку вне зоны (поиск: опора→нет хазарда→нет конвейера к люку; иначе выброс вверх vy=8).
- Двери: velocity-guard (N vy>1, S vy<−1, E/W |vx|>0.5); knockT 0.35 c; i-frames 1.0 c на прибытие; lock-стороны открываются проходом с обратной.
- Коллизии: support-геометрия сплошная (AABB, per-axis), полки цепей one-way (+drop-through S+Space), corner-correction 0.55 u, step-up ≤0.35 u, variable jump 1.95/2.9, coyote .12/jbuf .12, PW .34/PH 1.9.
- Платформинг: step ≤2.6 (base, JUMP_DY 2.8 в phys) / ≤4.6 servo; gap ≤5 base, ≤9.5 dash; LAUNCH-WINDOW ≥2.0 u при перекрытиях; head-clearance ≥2.05 u над дорожками/коридорами.
- Боссы: telegraph→execute→punish; хитбокс=визуал (e.y = visual y); визуал клампится к арене; contact только явный; untouchable-состояния (burrow).
- Враги: телеграф-контракт ctx.telegraph; edge-turn патролей; push-out летающих; контактный бокс ×0.85.
- Прогрессия без софтлоков: BFS по графу с фикс-точкой наград; тупик без награды = fail.

## 5. Тесты (все PASS на последнем срезе)
bfs_reach · phys_check (38/38, все нормативы) · audit_support · portal_audit (102: все двери+lock+лифт) ·
transitions (34 вертикальных) · climb_base (n3,n5 base-цепи+люк) · n9_climb (base-вылазка из подвала) ·
playtest (19 сценарных шагов) · boss_press · bosses_visual (7 боссов: рамки+desync<1.2) · fx_parallax (утечки/фон) ·
creation_look (режимы ввода+save). Headless: Playwright+Chromium/SwiftShader; FPS-порог >20 на software-GL (eco).
0 pageerror/console.error во всех прогонах.

## 6. Артефакты и состояние кода
- Игра: `dist/neon-warden_V2.html` (1.6 MB single-file; запуск: статик-сервер или file://; F9 сброс save).
- Git: `/home/user/game` main, tag v2.0 (commit 59796bf) + коммит с этим summary; zip-слепок для GitHub:
  `/home/user/neon-warden-v2-github.zip` (74 файла, префикс neon-warden-v2/; лицензия отсутствует по решению пользователя).
- Docs: AUDIT (вход), PLAN (миграция), LOCATIONS (6 паспортов биомов), ENEMIES (архетипы+боссы+best-practices),
  TESTS (результаты+фикс-раунды 1–11+чек-листы), README (запуск/управление/структура/нормативы/расширение), SUMMARY (этот файл).
- Screens: docs/screens/ (карта, граф, коллайдеры, debug, биомы, пресс, debris, climb, look_quality).

## 7. Известные ограничения / следующие шаги
- Камера комнатная (clamp), комнаты > экрана не поддерживаются (NES-грамматика, осознанно).
- Encyclopedia v1 отключена (меню-айтем = карта); discovery-данные menu.js не используются.
- eco-режим (software-GL): parallax off + bake PBR→Basic (стиль беднее, стабильность выше).
- Баланс боссов не проходил человеческого плейтеста (телеграфы/окна есть, тайминги могут тюниться).
- Кандидаты следующего раунда: hit-spark directionality, slow-mo на добивании, screen-edge pulse low-HP;
  прыжковые анимации врагов расширенные; геймпад; speedrun-таймер; комната-хаб с метро-лифтом; 2–3 side-босса.

## 8. Как продолжать новому сеансу
1. `cat README.md docs/SUMMARY.md docs/TESTS.md` — состояние и нормативы.
2. `node build.mjs` → `tests/*.mjs` (нужны playwright-core + chromium; в песочнице рабочие окружения были
   `/home/user/work/test` и `/home/user/game/tests`).
3. Любую новую комнату/врага/биом добавлять ДАННЫМИ (rooms.js / enemydefs.js / biomes.js) и прогонять
   bfs_reach → phys_check → portal_audit → climb_base/playtest: инварианты защищены тестами.
