# Delve — Design Document

> A cozy, absurd, D&D-flavored idle/incremental game for Android (installable web app).
> You are the **Digging God**, overseer of a colony that digs ever deeper — and fights its way through the caverns beside it.
> Inspirations: Trimps, Realm Grinder, Universal Paperclips, Evolve Idle.

This is a living document. Everything here can change.

---

## 1. Vision & pillars

1. **Constant unlocking.** New systems, resources, floors and screens keep opening up. Hour 10 should look nothing like minute 1.
2. **Deep, months-long progression.** Multiple prestige tiers, each making the previous loop faster and adding new layers.
3. **Strategy without lock-in.** Many viable builds; each run you choose a direction, and next run you can try another.
4. **Something to watch.** A visibly growing mine, bustling workers, ore with physics, and always-running combat with pretty abilities.
5. **Collect everything.** Every item, resource, creature and artifact is logged. Achievements everywhere.
6. **Heavily active AND heavily idle.** Huge upgrade trees supporting both; you pick a priority per run, but both always work.
7. **No waiting walls.** No energy systems. Full offline progress. Mini-game currency comes from playing, not timers.

**Tone:** cozy and charming, with lots of absurd humor. D&D-style world (classic races, classes, monsters) with original gods/characters plus goofy additions.

**Art:** pixel art with smooth animation, particles and juicy effects. Text panels where it makes sense.

---

## 2. Core structure: two tracks

### The Mine (economy & base)
- A vertical shaft shown as a side-view cross-section. Scrolls vertically (perfect for portrait phones).
- **Digging deeper** → new ores, new biomes, more floor slots, new floor types.
- Better ores → better **gear tiers** at the forge (copper → iron → mithril → adamantine → …).

### The Expedition (combat)
- A persistent, always-running, Trimps-style combat track through **zones** of cells with a boss at the end.
- Rewards: gold, monster parts, loot, **special workers**, **relics**, and **floor blueprints** from bosses.
- Player-triggered: boss fights, dungeons, abilities.

### How they connect
- Push combat with what you have; when you hit a wall, the mine (better gear, more workers, more stats) is how you break it.
- Combat feeds the mine with blueprints, specials and materials only monsters drop.
- **Hidden caverns:** digging occasionally breaks into a cavern → becomes a **dungeon** you can launch from the combat screen.
- Prestige points come from progress on both tracks.

---

## 3. The Mine

### Floors
- Every dug level is a **slot** for one **floor module** (Tavern, Mushroom Farm, Forge, Barracks, Library, Storage, Brewery, Shrine, …).
- **Build freely** in any slot you've dug; new modules unlock over time.
- **Duplicates allowed** — need more food? Build more farms.
- **Floor levels:** floors can be upgraded.
- **Staffing:** floors need workers assigned to run.
- **Depth biomes matter:** each depth band has a biome that buffs/nerfs certain floors (farms love damp layers, forges love magma).
- **Adjacency bonuses:** neighbors boost each other (Tavern next to Barracks = faster recruiting; Storage next to Smelter = faster smelting).
- Layout resets each run → re-optimizing is part of the puzzle, and differs by race.

### Biomes (draft, top to bottom)
1. Topsoil — worms, roots, the tutorial.
2. Stone — copper and tin.
3. Damp Caverns — mushrooms, underground lakes (fishing!).
4. Iron Seams — real smithing begins.
5. Magma Rift — smelting chains, fire stuff.
6. Ancient Ruins — relics, puzzle doors, lore.
7. Crystal Veins — magic and enchanting.
8. The Underdark — weird creatures, weird trades.
9. The Clockwork Deep — automation unlocks.
10. The Lasagna Layer — nobody knows why it's here.
11. …the Bottom? (Is there one?)

### Workers
- **Faceless classes**, assigned Trimps-style (move numbers between jobs).
- Starting classes: Miner, Farmer, Hauler, Brewer, Smith, Scholar, Soldier. More unlock (e.g. Bard: boosts morale).
- **Special workers**: rare, named; earned via combat, achievements, mini-games or events. Give colony-wide bonuses for the whole run.

---

## 4. Combat (the Expedition)

- Trimps-style: zones of cells, one enemy per cell, boss at the end; your army fights automatically.
- Army wiped → wait for reinforcements (barracks/breeding speed matters).
- **Watchable:** pixel squad marches, enemies stagger in, damage numbers, screen-filling bosses.
- **Stats:** HP, attack, armor/block, crit, lifesteal, AoE, summons, etc.
- **Abilities:** triggered or auto-cast (unlockable), with visible, pretty effects.
- **Player-triggered content:** boss battles, dungeons (from hidden caverns), special events.
- **Zone rewards** scale with depth; random loot and events.
- **Picture-in-picture** combat window can be pinned on other screens.

---

## 5. Progression & prestige

### Within a run
- Push as far as you can on both tracks. **Prestige points accrue continuously** the further you go.
- **Milestones multiply** points earned (Trimps helium-style).
- Short runs = a few points; long runs = push the max for many more.

### Prestige tiers (draft names)
| Tier | Name | Currency | Resets | Keeps |
|---|---|---|---|---|
| 1 | New Expedition | Divine Favor | Depth, floors, workers, resources, gear, combat zone, run skill trees | Divine Favor + Divine Tree, achievements, collection log, lifetime stats, unlocked races/gods, mini-game upgrades, Reliquary |
| 2 | Ascension | (TBD, e.g. Godsparks) | Tier 1 currency & Divine Tree | Tier 2 currency & upgrades, + everything above |
| 3+ | (later) | | | |

- Later runs should catch up to the previous best much faster, then push further until the next wall.
- Target: **first prestige within ~2 hours** for a new player.

### The Reliquary
- A limited set of slots for rare artifacts you choose to **keep across runs**.
- Artifacts not kept convert into bonus prestige points on reset.
- **Earn more slots** over time (achievements, prestige upgrades, special events).

---

## 6. Per-run choices

- **Race** — changes how the run plays (bonuses, unique floors, unique workers).
- **God** — who your colony worships; grants blessings/playstyle twists.
- **Focus** — a chosen stat/skill emphasis for the run.
- **Challenges** (later) — optional modifiers for permanent rewards.

### Races (draft)
D&D-style: Dwarf, Hill Dwarf, Elf, Drow, Halfling, Gnome, Human, Half-Orc, Tiefling, Dragonborn, Goliath, Kobold.
Goofy: Overly Polite Moles, Unionized Goblins (mandatory breaks, great benefits), Myconid Hippies, Pet Rocks, a Colony of Mimics (everything is furniture).

### Gods (draft, original names)
D&D-style: a dwarven Forge-Father, a goddess of luck and fortune, a god of the deep and darkness, a nature/roots goddess, a war god, a god of knowledge.
Goofy: **Snorg**, God of Snacks · **Pebble**, God of Rocks (only cares about rocks) · **The Eternal Middle Manager** · **Gary**, God of Naps.

---

## 7. Skills (proposed — awaiting confirmation)

### Skills level by doing (RuneScape-style)
- Five skills to start: **Combat**, **Digging**, **Colony**, **Hands-On** (tapping/combos), **Hands-Off** (automation/offline). More unlock later (Magic, Smithing, …).
- Each skill gains XP from its own activity: kills → Combat, levels dug and miner work → Digging, colony growth/production → Colony, taps and combos → Hands-On, time running idle/offline → Hands-Off.
- **Levels 1–99 on the RuneScape curve**: early levels come in minutes, level 50 takes days, 99 takes months. Idle and offline XP is reduced versus active play, so you can't max a skill overnight while AFK.
- **Skill levels and XP are permanent** — they never reset on prestige.

### Skill points
- Each skill level = 1 point for **that skill's tree**.
- **General points** (spend in any tree) come from achievements and first-time feats (each guardian, zone milestones, first prestige…), so they're earned once, not farmed.

### Major trees (one per skill)
- A **big node map** you can pan, organised into **tiers**: spend N points in a tree to open its next tier, so there's always a clear next goal.
- Node types: small passives (+3% damage), larger **notables**, **abilities** (actives like Battle Cry), **keystones** with big trade-offs (Glass Cannon: +100% damage, −50% HP), and **choice nodes** (pick one of two; the other locks).
- Allocations persist across runs. **Respec only when you prestige.**

### Run perks (per run)
- A smaller per-run board fed by **run points** from zone bosses and guardians this run.
- Resets every prestige; can be **respecced mid-run for gold**.

### Abilities & loadout
- Abilities are only earned from trees. You **equip a limited loadout** (start with 2 slots; more from nodes).
- Auto-casting is a Hands-Off tree unlock.

### Divine Tree
- Unchanged: permanent upgrades bought with Divine Favor.

---

## 8. Mini-games & activities

Useful from early game to endgame. Rewards include resources, bonus money/ore, achievements, and **items you can't get anywhere else**. Each activity can be upgraded so it scales with the game.

- **Plinko Ore Drop** — physics, fun to watch.
- **Mine-Cart Gamble**
- **Slots & Dice** (in-game currency only)
- **Lockpicking / Puzzle Doors** (Ancient Ruins)
- **Fishing** (underground lakes)
- **Merchants & Trading**
- More later.

---

## 9. Collection & achievements

- **Stat Book**: every item, resource, creature (bestiary), worker type and artifact logged — current amount and lifetime total.
- Different tracking styles per category (resources = counts; artifacts = discovered/rarity; creatures = kills/first seen).
- Rare artifacts tie into prestige (Reliquary, bonus points).
- **Achievements** everywhere, with rewards.
- **Lore artifacts** (later): flavor text about our made-up universe.

---

## 10. Interface (portrait phone)

- **Full-screen mine view**, vertical scroll.
- **Thin top bar**: key resources.
- **Bottom tab bar**: Mine · Colony · Combat · Skills · Activities · Collection.
- **Bottom-sheet menus** slide up over ~2/3 of the screen, swipe down to peek.
- **Combat**: own full view + pinnable picture-in-picture.

---

## 11. Technical

- Web app (HTML/JS, canvas rendering), installable on Android as a PWA, works offline.
- **Data-driven content**: resources, floors, biomes, enemies, upgrades, achievements defined as data → cheap to add more.
- Autosave + full offline progress calculation.
- Big-number support (games like this reach enormous values).
- **Dev panel**: time speed (×10/×100), resource cheats, save import/export — for testing without changing balance.
- Hosting: GitHub Pages (free) or similar.

---

## 12. Decisions

- **Combat army:** starts as plain Recruits; classes (Fighter, Cleric, Wizard, …) unlock one at a time via research and are assigned like jobs.
- **Guardian bosses:** yes — each new biome is sealed by a guardian that must be beaten in combat before miners can dig past.

## 13. Build status

**v0.1 (first playable)**
- Mine with 5 biomes, 8 floor types, biome multipliers, neighbour bonuses, floor levels, demolish.
- Trimps-style jobs (Miner, Farmer, Scholar), colony growth fed by mushrooms, storage caps.
- Tap-to-dig (hands-on) plus miners (hands-off).
- Expedition: zones of 25 cells with bosses, Recruit/Fighter/Cleric/Wizard, squad wipes and regrouping, Battle Cry & Shield Wall, auto-cast, farm/push toggle, 4 guardians.
- Armory: weapon & armour levels and tiers (stone → copper → iron).
- 14 research projects; Divine Favor prestige with an 11-node Divine Tree; Reliquary.
- Races: Hill Dwarves, Unionized Goblins. Gods: Forge-Father, Snorg, Pebble.
- 32 achievements (+2% each), Stat Book (resources, items, relics, bestiary, stats).
- 5 save slots, rolling backup, autosave, export/import (code or file), offline progress.
- Installable PWA with offline support; dev panel (speed ×10–×1000, cheats).

**Next up (candidates)**
- Mini-games: Plinko Ore Drop, Mine-Cart Gamble.
- Run skill trees (Combat / Digging / Economy, Hands-On vs Hands-Off).
- Hidden caverns → dungeons.
- More biomes, races, gods, enemies, relics; tier-2 prestige (Ascension).
- Balance pass on the first ~2 hours.
