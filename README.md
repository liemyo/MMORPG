# Veyra: Crystal Wars

A single-player, offline 2.5D/3D faction-war RPG for the browser (Three.js). Other players are simulated by AI bots. Everything here is original: the world, names, lore, and models. The graphics are low-poly placeholder primitives.

## How to run

ES modules need an HTTP server (opening `index.html` directly won't work):

```bash
cd veyra-rpg && python3 -m http.server 8790
```

Then open http://localhost:8790. Three.js loads from a CDN (`three@0.160.0`), so the first load needs internet. After that the browser cache is enough.
Alternative: `./run.sh` (it starts the server and opens the browser).

## Controls

| Key | Function |
|---|---|
| WASD / arrows | Move |
| Right/left drag, Q/E | Rotate camera · scroll = zoom |
| Click / Tab | Select target (click an NPC/node/portal = walk there and interact) |
| 1–8 | Skills · 9 = HP potion · 0 = MP potion |
| F | Interact with NPCs / gather ore & crystal nodes |
| Space | Jump |
| I / C / K / L / M | Inventory / Character / Skills / Quests / Teleport map |
| Enter | Chat (`/help`, `/save`, `/where`, `/stats`) |
| Esc | Close windows / system menu (save, export JSON, back to menu) |
| **F10** | Developer panel: add money, set level, spawn items, teleport, god mode, start war, speed x2, toggle Sandbox/Normal |

## Folder structure

```
veyra-rpg/
├── index.html          # HUD skeleton + importmap three.js
├── css/style.css       # all UI (HUD, windows, menu, nameplates)
├── run.sh              # local server + opens the browser
└── js/
    ├── main.js         # boot, startGame, zone travel, key bindings, core loop
    ├── data.js         # factions, classes, skills, job advancement (lv 30/50), XP curve
    ├── items.js        # item generator (8 tiers × 6 slots), gems, materials, recipes, upgrade table
    ├── zones.js        # 3 cities, 3 leveling zones, Crystal Core, monsters, main + daily quests
    ├── state.js        # global state G, event bus, character, stats, economy (Normal/Sandbox), save/load JSON
    ├── engine.js       # renderer, orbit camera, input, terrain heightmap, floating text, nameplates
    ├── world.js        # builds zones: terrain, props, NPCs, portals, gather nodes, capture point
    ├── models.js       # placeholder models (humanoid per faction/class, 9 monster shapes)
    ├── units.js        # Unit class, spawning monsters/bots, monster AI & AI players
    ├── combat.js       # skills, damage, crit, buff/debuff, DoT, stun/slow, death, XP/loot, FX
    ├── player.js       # player controller, targeting, hotbar, gathering
    ├── inventory.js    # 40-slot grid, equip, potions, shop buy/sell, upgrade +15, gem sockets, crafting
    ├── quests.js       # 14-chapter main quest, 3 daily quests, job advancement
    ├── war.js          # faction war every 30 min (5 min long) + world chat bots
    └── ui/
        ├── hud.js      # HP/MP/XP, target frame, hotbar+cooldowns, minimap, chat, quest tracker, war box
        ├── windows.js  # window manager + Inventory, Character, Skill Tree
        ├── npcwin.js   # Shops (general/gear/premium), Refiner, Artisan, Gate Warden, Quests/Job, Menu
        ├── cheat.js    # F10 panel
        └── menu.js     # main menu, Sandbox Mode, save slots, import JSON, character creation + 3D preview
```

## Systems

- **Factions:** Orbital Union (+DEF/HP), Sylvaran Covenant (+MP/skill damage), Ferron Legion (+ATK/CRIT). Each faction has its own city, model style, and class titles.
- **Classes:** Warrior, Ranger, Caster, Specialist. Each has 6 base skills plus 2 job paths. At level 30 you pick a path (e.g. Bulwark or Berserker); at level 50 it advances to tier 2 (Aegis Lord / Warlord) with a new skill and doubled stat bonuses.
- **Level 1–60:** curve `80·lv^1.65+40`, 1 skill point per level, skill ranks 1–5 (+12% power per rank).
- **Items:** 8 tiers, 3 rarities, upgrades from +0 to +15. Success chance runs from 100% down to 5%. **A failed upgrade drops the item one level; it is never destroyed.** Weapons and armor have 1–3 gem slots, with 5 gem types × 3 tiers.
- **Crafting:** gather ore, crystal, lumen, and core from nodes (F), then craft at the Artisan (ingots, catalysts, potions, gems, rare/epic gear).
- **Zones:** 3 faction cities (safe), Shardfall Verge (1–12), Glasswood Expanse (12–28), Ashen Rift (28–45), and Crystal Core (40–60, PvP). Each leveling zone has an elite and a boss.
- **Faction war:** every 30 minutes, lasting 5 minutes. Score comes from standing in the capture ring (1/s) and kills (+3). The winning faction gets **+50% drops and Credits** until the next war. When you're in another zone, the war is simulated in the abstract.
- **Economy:** Credits plus Core Shards (premium in-game currency, from quests, PvP, and daily quests). **Sandbox Mode** (main menu): both currencies show ∞, every shop and upgrade is free and unlimited. **Normal Mode:** balanced economy. Mode can also be switched from F10.
- **Save:** 3 slots in localStorage (JSON), autosave every 60 s, plus export/import of `.json` files.

## Visuals

The style is a semi-realistic sci-fi MMO from the 2000s. Everything is procedural and original, with no external images or models.

- **Renderer:** ACES tone mapping, bloom, soft shadows, and an environment map built from the sky (`engine.js`).
- **Sky** (`gfx/sky.js`): a gradient sky dome with procedural clouds and stars, fog per zone, and floating light motes.
- **Textures** (`gfx/textures.js`): tileable canvas textures for ground, armor panels, cloth, monster hide, rock, bark and windows.
- **World** (`world.js`): terrain tinted by slope, instanced grass that sways in the wind, rocks, crystals, trees, ruins and distant mountains. Each faction city has its own architecture.
- **Characters** (`models.js`): a jointed rig (hips, spine, elbows, knees) with realistic proportions, armor per faction, class weapons, and procedural animation.
- **Monsters** (`monsters.js`): 9 types with jointed legs and glowing eyes. **Effects** (`gfx/fx.js`): projectiles with trails, shockwaves, particles and auras.
- **UI:** dark metallic frames with bronze trim, using the Cinzel and Rajdhani fonts.

## Mobile

Touch devices switch to mobile mode automatically. You can also force it with `?mobile=1` or turn it off with `?mobile=0`.

- **Movement:** the virtual joystick on the bottom left.
- **Camera:** drag with one finger to rotate and pinch with two fingers to zoom. Tap a monster or NPC to target it.
- **Actions:** the bottom right has 8 skill buttons plus Target, Interact (F), Jump, HP potion and MP potion.
- **Graphics:** quality drops automatically (lower resolution, smaller shadows, less grass) to keep the frame rate smooth.
- **Install:** add the game to the home screen to play fullscreen in landscape.

## Replacing placeholder graphics

All models come from `js/models.js` (`buildHumanoid`, `buildMonster`). To use real assets, load a GLTF with `GLTFLoader` and return `{ root, parts, height }` in the same shape. Animation in `units.js#animate` uses `parts.legL/legR/armL/armR/body`. If your model uses skeletal animation, replace it with an `AnimationMixer`.

## Next steps (not yet built)

- Pets/mounts and a real mech exo-suit for Orbital Union (a transform skill)
- A party system with AI bots (invite a bot, shared XP)
- Sound and music
- An auction house among the AI bots
