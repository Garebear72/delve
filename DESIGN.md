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

### Biomes (built, top to bottom; each boundary is sealed by a guardian)
| Depth | Biome | Guardian at its entrance | New ore |
|---|---|---|---|
| 0 | Topsoil | — | — |
| 8 | Stone Layer | The Very Large Worm | copper |
| 20 | Damp Caverns | Sir Stonejaw, Golem Knight | — |
| 35 | Iron Seams | Mother Mycelia | iron |
| 55 | Magma Rift | Grand Rustmaw | — |
| 80 | Crystal Grotto | The Glimmerwyrm | crystal |
| 110 | Mithril Deeps | Grumbleforge, the Duergar King | mithril |
| 145 | The Sunless Sea | Admiral Squidbeard | — |
| 185 | Bone Catacombs | The Lich Who Lost Their Keys | — |
| 230 | The Hollow Core | The Sleepy Tarrasque | — |
| 280 | The Astral Undercroft | The Dreaming Godling (only challengeable after at least one Ascension) | — |

Ideas for later biomes: Ancient Ruins (puzzle doors, lore), The Underdark, The Clockwork Deep (automation), The Lasagna Layer (nobody knows why it's here), …the Bottom?

### Workers
- **Faceless classes**, assigned Trimps-style (move numbers between jobs).
- Starting classes: Miner, Farmer, Hauler, Brewer, Smith, Scholar, Soldier. More unlock (e.g. Bard: boosts morale).
- **Special workers**: rare, named; earned via combat, achievements, mini-games or events. Give colony-wide bonuses for the whole run.

---

## 4. Combat (the Expedition)

- Trimps-style: zones of cells, one enemy per cell, boss at the end; your army fights automatically.
- **Soldiers are a job** (decided 2026-10-22): colonists in the squad plan stay soldiers and stay in the colony. A wiped squad is **knocked out**, not killed: it gets back up after the regroup time (20 s base, faster with Barracks, skills and research), so wipes never cost colonists or stall the Expedition. The enemy that won is fully healed (a fresh one spawns).
- Losing to a zone boss → the squad loops that zone's normal monsters until the player taps "Retry boss". Losing to a guardian → back to zone fights; Challenge again manually.
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
| 2 | Ascension (built) | Godsparks ✨ | The run, Divine Favor & the whole Divine Tree | Godsparks + Celestial Tree, + everything above (skills, prestige count, races/gods, Curios, Heirlooms) |
| 3+ | (later) | | | |

- Later runs should catch up to the previous best much faster, then push further until the next wall.
- Target: **first prestige within ~2 hours** for a new player.
- **Favor** = (depth^1.4/8 + zone^1.7/3), ×1.008 per level past depth 35 and ×1.01 per zone past 20, × Shrines, guardians beaten (×1.25 each), skills, research, Curios and Wheel blessings.

### Ascension (tier 2, built)
- **Unlocks** once any run reaches the Sunless Sea (depth 145). Saves from before Ascension count all their Favor so far.
- **Godsparks** = ⌊√(Favor earned since the last Ascension ÷ 5,000)⌋, counting this run's pending Favor. 4× the Favor = 2× the sparks, so each Ascension wants a longer cycle.
- **Celestial Tree** (`CELESTIAL` in defs.ts): Starfire (Favor ×1.5/level), Astral Might (squad dmg+HP ×1.5/level), Heavenly Industry (jobs + gold ×1.5/level) all compound, costs ×2 per level. Humbled Guardians (−15% guardian HP, max 5), Divine Bargain (−8% Divine Tree costs, max 5). Faster early runs: Running Start (start at depth 8/20/35/55/80 with those guardians beaten), Forced March (zones below 10/20/30 fight like zone 1), Celestial Librarians (Auto-Research) and Stubborn Squad (Auto-Retry zone bosses after 30 s); the automation two can be switched off.
- **New patrons:** Star-Touched Moles (1st Ascension), Twinkle, God of Very Small Stars (2nd Ascension).
- **Content gate:** the 11th biome, the Astral Undercroft (depth 280); its guardian only fights a god who has Ascended.
- Bot ascends when it would at least double its lifetime Godsparks (`tools/bot.js`, `ascend` option).

### Pacing targets (measured with the autoplay bot: `npx tsx tools/pacing.mjs 96`)
The bot plays efficiently around the clock (taps a quarter of the time); a real player is roughly 2–3× slower.

| Milestone | Bot (game time) | Real player (rough) |
|---|---|---|
| The Very Large Worm | ~27 min | ~45–60 min |
| Magma Rift (55) | ~3–4 h | ~8–10 h |
| Crystal Grotto (80) | ~8–11 h | ~1 day |
| Mithril Deeps (110) | ~15–19 h | ~2 days |
| Sunless Sea (145) / Ascension unlocks | ~28–31 h | ~3–4 days |
| 1st Ascension (+6 ✨) | ~31 h | ~4 days |
| Bone Catacombs (185) | ~95 h (after 3 Ascensions) | ~1.5–2 weeks |
| Hollow Core (230), Astral Undercroft (280) | beyond 200 h | many weeks |

Measured 2026-10-21 with `npx tsx tools/pacing.mjs 200 400`. Without Ascension the bot sat at the Sunless Sea from ~44 h to 96 h, earning 130k–172k Favor per run. With it, Ascensions came at 31 h (+6 ✨), 47 h (+7), 66 h (+13), 108 h (+26) and 178 h (+54), getting further apart each time. By 200 h the bot was at depth 204 and zone 101, earning ~1.6M Favor per run, with Celestial levels starfire 4, might 4, industry 4. The next wall is the Sleepy Tarrasque (230); a tier-3 layer or more Celestial nodes are the next lever. Comparable games: first prestige ~1–2 h (Antimatter Dimensions, Realm Grinder), Trimps' first Portal several hours in.

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

## 7. Skills (built in v0.2; trees will keep growing)

### Skills level by doing (RuneScape-style)
- Five skills to start: **Combat**, **Digging**, **Colony**, **Hands-On** (tapping/combos), **Hands-Off** (automation/offline). More unlock later (Magic, Smithing, …).
- Each skill gains XP from its own activity: kills → Combat, levels dug and miner work → Digging, colony growth/production → Colony, taps and combos → Hands-On, time running idle/offline → Hands-Off.
- **Levels 1–99 on the RuneScape curve**: early levels come in minutes, level 50 takes days, 99 takes months. Idle and offline XP is reduced versus active play, so you can't max a skill overnight while AFK.
- **Skill levels and XP are permanent** — they never reset on prestige.

### Skill points
- Points for **that skill's tree only**, spread **evenly from level 1 to 99**; level 99 gives exactly enough to master the whole tree (≈70–80 points). No general/free points.
- Trees: 22–26 nodes each over 6 tiers, ending in a pick-one keystone pair plus a capstone notable.
- XP is slow by design (RuneScape curve); Hands-On XP counts at most 5 taps per second.

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
- Permanent upgrades bought with Divine Favor. The main multipliers **compound** (×1.15 per level), so Favor keeps paying off deep into the game; utility nodes (Head Start, Ancestral Halls, Divine Tactics, Long Memory, Reliquary, Fortune's Favor) are flat.

---

## 8. Mini-games & activities

Useful from early game to endgame. Rewards include resources, bonus money/ore, achievements, and **items you can't get anywhere else**. Each activity can be upgraded so it scales with the game.

**Unlock pacing (decided):** one mini-game per prestige, so the fourth arrives after the fourth prestige — the game is meant to last a long time. Order: 1 Goblin Dice → 2 Plinko Ore Drop → 3 Mine-Cart Gamble → 4 Wheel of the Gods. The Games tab appears after the first prestige; only the next locked game is teased. Each game may also need an in-run venue (Goblin Dice needs a Tavern this run). The Games tab lists a card per unlocked game; tapping one opens that game **full screen** (its own view over everything, Android back closes it), with a shared header and an events strip reserved for future in-game events.

**Curios (built):** permanent collectibles only mini-games give, each with a small permanent bonus; up to 5 copies count (each copy stacks). Every play rolls for one: Common ~1/30, Rare ~1/300, Legendary ~1/3000, times luck. Each game has its own pool. Shown in the Games tab and the Book.

**Plinko Ore Drop (built, prestige 2):** each drop costs 10% of your stone storage and pays gold × the landing slot (×5/×2/×1/×0.5/×0.3). Balls step one column per row; off either side = gutter. Middle drops are safest, edges chase ×5 (3× Curio luck). A golden peg moves after every drop: pass through it for 3× Curio luck.

**Mine-Cart Gamble (built, prestige 3):** a ride costs 2 dice bets of gold; 4 forks, each sturdy (80% safe, ×1.2) or rickety (50%, ×1.8, more Curio luck); bail out any time after the first fork. One Curio roll per fork survived when the ride ends.

**Wheel of the Gods (built, prestige 4, needs a Shrine):** one free spin per run, extra spins cost Favor (2% of all Favor ever earned, doubling per spin). Blessings last the run: digging ×2, mushrooms ×3, gold ×2, squad damage ×2, +25% Favor, +50% XP, three ×5-luck Curio rolls, or nothing.

**Goblin Dice (built, prestige 1):** bet gold (50 × 1.25^(zones cleared this run − 1)); 2d6 vs the goblin's 2d6, goblin wins ties; win ×1.8, double sixes ×3; then cash out or double-or-nothing. Curio luck ×1.5 per win in the current streak. Bets return ~84% on average: the gold is a cost, Curios are the prize.

Ideas for later activities:
- **Lockpicking / Puzzle Doors** (Ancient Ruins)
- **Fishing** (underground lakes)
- **Merchants & Trading**
- More later.

---

## 8b. Dungeons (built)

- Unlock once Sir Stonejaw has ever been beaten. Digging past depth 10 has a 6% chance per level to break into a **Hidden Cavern** (hold up to 3). Caverns appear as cave mouths in the mine (tap to explore) and in the Battle tab.
- Explore full screen: 6 rooms of 3 doors (⚔️ monster, ☠️ elite, 💰 treasure, ⛲ fountain, ❓ mystery), then the cavern's boss (named by depth). Party = your squad plan at full strength (costs no colonists). Party HP carries between rooms; retreat any time with your loot.
- Fights cost a random share of the party's max HP (monster 14%, elite 30%, boss 60%, ×0.6–1.4, Fighters' block softens it), so the challenge is choosing doors, not raw power. Random play clears ~57% of caverns (`npx tsx tools/dungeon-test.mjs`).
- Rewards: gold scaled to your best zone, 15% boss relic chance, and **Heirlooms** — 9 permanent Curio-like collectibles found only in caverns (treasure, elites, mystery and bosses roll for them).

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

**v0.2** — Skills (5 skills, RuneScape curve, ~118-node trees), run perks, ability loadout, Goblin Dice + Curios, Games tab, full-screen mini-game view, zone-boss retry.

**v0.3**
- 5 new biomes (to depth 230+) with 5 new guardians; crystal and mithril ores and gear tiers; 10 new monsters and 3 new zone bosses; 13 items; 8 relics; 20 research projects; Treasury, Training Grounds and Smeltery floors; Tinkering Gnomes, Kobold Hoarders, Krog and Grandmother Moss; 5 new Divine upgrades; ~40 new achievements.
- Long-game pacing pass with the autoplay bot (compounding Divine Tree, exponential deep Favor, gentler deep curves, slower deep XP).
- Plinko Ore Drop, Mine-Cart Gamble, Wheel of the Gods (+24 Curios).
- Dungeons (Hidden Caverns) + 9 Heirlooms.
- Synthesised sound effects (Menu toggle + volume), a "next goal" guide in the hint line, more battle backgrounds, offline report shows caverns.

**v0.4** — Ascension (tier-2 prestige): Godsparks, the 9-node Celestial Tree (multipliers, Running Start, Forced March, Auto-Research, Auto-Retry), Star-Touched Moles and Twinkle, the Astral Undercroft biome and the Dreaming Godling, 5 achievements; the bot ascends.

**v0.5** — PC support (Auto/Phone/Wide layouts, docked panels, battle strip, three-column extra-wide view, contained mini-game window, mouse wheel and keyboard) and cloud saves (username + password accounts on Supabase, automatic sync with revision checks, "which save?" prompt, optional "always use the latest save").

**Next up (candidates)**
- More cavern room types and events; Ancient Ruins biome with puzzle doors; special named workers.
- Mini-game upgrades (Plinko auto-dropper, cart insurance) and in-game events in the arcade events strip.
- Optional auto-retry for zone bosses (as a skill node or research).
