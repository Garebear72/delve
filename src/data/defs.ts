// All game content lives here as data. Add content by adding entries.
import type { GameState } from '../game/state';

type Cost = Partial<Record<ResId, number>>;

// ---------------------------------------------------------------- resources
export type ResId = 'food' | 'stone' | 'copper' | 'iron' | 'gold' | 'knowledge';
export const RES_IDS: ResId[] = ['food', 'stone', 'copper', 'iron', 'gold', 'knowledge'];
export const RESOURCES: Record<ResId, { name: string; icon: string; capped: boolean }> = {
  food: { name: 'Mushrooms', icon: 'i_food', capped: true },
  stone: { name: 'Stone', icon: 'i_stone', capped: true },
  copper: { name: 'Copper', icon: 'i_copper', capped: true },
  iron: { name: 'Iron', icon: 'i_iron', capped: true },
  gold: { name: 'Gold', icon: 'i_gold', capped: false },
  knowledge: { name: 'Knowledge', icon: 'i_know', capped: false },
};

// ---------------------------------------------------------------- jobs
export type JobId = 'miner' | 'farmer' | 'scholar';
export const JOB_IDS: JobId[] = ['miner', 'farmer', 'scholar'];
export const JOBS: Record<JobId, { name: string; desc: string; unlock: (s: GameState) => boolean }> = {
  miner: { name: 'Miner', desc: 'Digs deeper and hauls up stone and ore.', unlock: () => true },
  farmer: { name: 'Farmer', desc: 'Grows mushrooms. Everyone eats.', unlock: () => true },
  scholar: {
    name: 'Scholar',
    desc: 'Produces Knowledge. Needs a Library.',
    unlock: (s) => s.run.floors.some((f) => f?.type === 'library'),
  },
};

// ---------------------------------------------------------------- floors
export type FloorId = 'bunk' | 'farm' | 'storage' | 'tavern' | 'barracks' | 'library' | 'forge' | 'shrine';
export const FLOOR_IDS: FloorId[] = ['bunk', 'farm', 'storage', 'tavern', 'barracks', 'library', 'forge', 'shrine'];
export interface FloorDef {
  name: string;
  desc: string;
  cost: Cost;
  color: string;
  props: string[];
  unlock: (s: GameState) => boolean;
  unlockText: string;
}
export const FLOORS: Record<FloorId, FloorDef> = {
  bunk: {
    name: 'Bunkhouse', desc: '+4 max colonists per level.', cost: { stone: 25 }, color: '#5b3a4a',
    props: ['bed', 'bed', 'bed'], unlock: () => true, unlockText: '',
  },
  farm: {
    name: 'Mushroom Farm', desc: '+50% farmer output per level.', cost: { stone: 10 }, color: '#3a4a2e',
    props: ['mush', 'mush', 'mush', 'mush'], unlock: () => true, unlockText: '',
  },
  storage: {
    name: 'Storage', desc: '+200 resource storage per level.', cost: { stone: 30 }, color: '#4a3c2a',
    props: ['crate', 'barrel', 'crate'], unlock: (s) => s.run.depth >= 3, unlockText: 'Dig to depth 3',
  },
  tavern: {
    name: 'Tavern', desc: '+50% colony growth per level.', cost: { stone: 50, food: 40 }, color: '#5a3a24',
    props: ['mug', 'barrel', 'mug'], unlock: (s) => s.run.pop >= 10, unlockText: 'Reach 10 colonists',
  },
  barracks: {
    name: 'Barracks', desc: '+3 squad size and faster regrouping per level.', cost: { stone: 60, food: 30 }, color: '#4a2a2a',
    props: ['flag', 'anvil', 'flag'], unlock: (s) => s.run.depth >= 5, unlockText: 'Dig to depth 5',
  },
  library: {
    name: 'Library', desc: 'Enables Scholars. +50% knowledge per level.', cost: { stone: 80, gold: 15 }, color: '#2e3550',
    props: ['books', 'books'], unlock: (s) => s.run.depth >= 7 && s.run.combatUnlocked, unlockText: 'Dig to depth 7 and open the Barracks',
  },
  forge: {
    name: 'Forge', desc: 'Needed for better gear. -20% gear cost per level.', cost: { stone: 100, copper: 25 }, color: '#4a2e22',
    props: ['fire', 'anvil'], unlock: (s) => s.run.research.includes('copperSmelt'), unlockText: 'Research Copper Smelting',
  },
  shrine: {
    name: 'Shrine', desc: '+15% Divine Favor per level.', cost: { stone: 250, gold: 100 }, color: '#3d2e55',
    props: ['altar'], unlock: (s) => s.run.maxZone >= 5, unlockText: 'Reach Expedition zone 5',
  },
};
// Neighbouring floors that boost each other (+25% each).
export const ADJACENCY: [FloorId, FloorId][] = [
  ['tavern', 'barracks'], ['storage', 'forge'], ['farm', 'tavern'], ['library', 'shrine'], ['bunk', 'tavern'],
];

// ---------------------------------------------------------------- biomes & guardians
export interface BiomeDef {
  id: string;
  name: string;
  from: number;
  colors: [string, string, string];
  speck: string;
  floorMult: Partial<Record<FloorId, number>>;
}
export const BIOMES: BiomeDef[] = [
  { id: 'topsoil', name: 'Topsoil', from: 0, colors: ['#6b4a2f', '#5a3d26', '#7a5636'], speck: '#a07a50', floorMult: { farm: 1.25 } },
  { id: 'stone', name: 'Stone Layer', from: 8, colors: ['#5f5a55', '#4e4945', '#6d6862'], speck: '#c27b3e', floorMult: { storage: 1.3, forge: 1.2, farm: 0.8 } },
  { id: 'damp', name: 'Damp Caverns', from: 20, colors: ['#3d4f4a', '#33433f', '#4a5f58'], speck: '#7bd5f5', floorMult: { farm: 1.6, tavern: 1.2, library: 0.8, forge: 0.7 } },
  { id: 'iron', name: 'Iron Seams', from: 35, colors: ['#4a4650', '#3c3842', '#58535f'], speck: '#d6d6e0', floorMult: { forge: 1.5, barracks: 1.25, farm: 0.7 } },
  { id: 'magma', name: 'Magma Rift', from: 55, colors: ['#4a2a24', '#3a201c', '#5c342b'], speck: '#df7126', floorMult: { forge: 2, farm: 0.5, shrine: 1.3 } },
];
// GUARDIANS[i] seals the entrance to BIOMES[i + 1].
export const GUARDIANS: { name: string; sprite: string; pal: Record<string, string>; scale: number; hp: number; atk: number; relic: string }[] = [
  { name: 'The Very Large Worm', sprite: 'worm', pal: {}, scale: 6, hp: 1500, atk: 22, relic: 'wormTooth' },
  { name: 'Sir Stonejaw, Golem Knight', sprite: 'golem', pal: {}, scale: 6, hp: 25000, atk: 160, relic: 'monocle' },
  { name: 'Mother Mycelia', sprite: 'shroom', pal: { r: '#8f56c9', w: '#fbf236' }, scale: 8, hp: 400000, atk: 1800, relic: 'sporeCrown' },
  { name: 'Grand Rustmaw', sprite: 'troll', pal: { G: '#c27b3e', B: '#7a3e1a' }, scale: 7, hp: 8e6, atk: 25000, relic: 'rustHeart' },
];

// ---------------------------------------------------------------- combat
export type ClassId = 'recruit' | 'fighter' | 'cleric' | 'wizard';
export const CLASS_IDS: ClassId[] = ['recruit', 'fighter', 'cleric', 'wizard'];
// atk = damage per hit, speed = seconds between that soldier's swings, heal = HP per second (pulsed).
export const CLASSES: Record<ClassId, {
  name: string; desc: string; hp: number; atk: number; speed: number; heal: number; block: number;
  pal: Record<string, string>; unlock: (s: GameState) => boolean; unlockText: string;
}> = {
  recruit: { name: 'Recruit', desc: 'Eager. Holds a stick.', hp: 20, atk: 4, speed: 1.0, heal: 0, block: 0, pal: { c: '#8a6b4a', h: '#6f6559' }, unlock: () => true, unlockText: '' },
  fighter: { name: 'Fighter', desc: 'Tough. Blocks damage for the squad.', hp: 50, atk: 4, speed: 1.3, heal: 0, block: 0.5, pal: { c: '#9badb7', h: '#5c6b78' }, unlock: (s) => s.run.research.includes('drill'), unlockText: 'Research Drill Training' },
  cleric: { name: 'Cleric', desc: 'Heals the squad every few seconds.', hp: 15, atk: 2, speed: 1.6, heal: 1.5, block: 0, pal: { c: '#f4f4f4', h: '#fbf236' }, unlock: (s) => s.run.research.includes('medicine'), unlockText: 'Research Field Medicine' },
  wizard: { name: 'Wizard', desc: 'Fragile. Slow, huge arcane blasts.', hp: 12, atk: 30, speed: 2.2, heal: 0, block: 0, pal: { c: '#8f56c9', h: '#5b2f8a' }, unlock: (s) => s.run.research.includes('arcane'), unlockText: 'Research Arcane Studies' },
};
export const ZONE_CELLS = 25;
// Zone 1 enemy stats and how fast they grow per zone (bosses ×6 HP, ×2 attack).
export const ENEMY_HP = 50;
export const ENEMY_HP_GROWTH = 1.4;
export const ENEMY_ATK = 5; // damage per second
export const ENEMY_ATK_GROWTH = 1.32;
export const CRIT_CHANCE = 0.05;

// Combat abilities. None are free: each is earned from the skill tree.
export type AbilityId = 'cry' | 'wall';
export const ABILITIES: Record<AbilityId, { name: string; desc: string; duration: number; cooldown: number }> = {
  cry: { name: 'Battle Cry', desc: 'Your squad deals double damage for 10s.', duration: 10, cooldown: 45 },
  wall: { name: 'Shield Wall', desc: 'Your squad takes 75% less damage for 8s.', duration: 8, cooldown: 60 },
};
export const MAX_VOLLEYS = 6; // big groups of one class swing in at most this many volleys
export const HEAL_PULSE = 2; // seconds between healing pulses
export const KILL_HEAL = 0.25; // share of max HP the squad recovers per enemy defeated (skills may raise this)
export const FOOD_PER_COLONIST = 0.15; // mushrooms eaten per colonist per second
export const STARVE_INTERVAL = 15; // seconds between hungry colonists wandering off
export const GROWTH_BASE = 0.012; // new colonists per second, plus...
export const GROWTH_PER_POP = 0.002; // ...this much per existing colonist
export const FOOD_PER_BIRTH = 5; // mushrooms it takes to raise a new colonist
export const COMBO_WINDOW = 1500; // ms between taps before the combo resets
export const COMBO_STEP = 0.01; // +1% tap power per combo step...
export const COMBO_MAX = 0.5; // ...up to +50%

export const ENEMIES: Record<string, { name: string; sprite: string; pal: Record<string, string>; item: string; from: number }> = {
  rat: { name: 'Cave Rat', sprite: 'rat', pal: {}, item: 'ratTail', from: 1 },
  slime: { name: 'Slime', sprite: 'slime', pal: {}, item: 'jelly', from: 1 },
  bat: { name: 'Grumpy Bat', sprite: 'bat', pal: {}, item: 'batWing', from: 3 },
  goblin: { name: 'Wild Goblin', sprite: 'goblin', pal: {}, item: 'sock', from: 6 },
  kobold: { name: 'Kobold', sprite: 'kobold', pal: {}, item: 'button', from: 7 },
  shroom: { name: 'Myconid', sprite: 'shroom', pal: {}, item: 'spore', from: 10 },
  blueslime: { name: 'Gelatinous Cube-ish', sprite: 'slime', pal: { g: '#5fcde4', G: '#306082' }, item: 'jelly', from: 13 },
  troll: { name: 'Cave Troll', sprite: 'troll', pal: {}, item: 'toenail', from: 999 }, // boss only
};

export const ITEMS: Record<string, { name: string; desc: string }> = {
  ratTail: { name: 'Rat Tail', desc: 'Still wiggles a bit.' },
  jelly: { name: 'Slime Jelly', desc: 'Goes great on toast, allegedly.' },
  batWing: { name: 'Bat Wing', desc: 'Leathery and judgemental.' },
  sock: { name: 'Goblin Sock', desc: 'Never in pairs. Never clean.' },
  button: { name: 'Shiny Button', desc: 'Kobolds trade these like currency.' },
  spore: { name: 'Spore Puff', desc: 'Do not sneeze near it.' },
  toenail: { name: 'Troll Toenail', desc: 'Surprisingly valuable. Surprisingly large.' },
};

export type RelicEffect = 'dig' | 'food' | 'know' | 'gold' | 'atk' | 'hp' | 'growth';
export const RELICS: Record<string, { name: string; desc: string; effect: RelicEffect; value: number; rare: boolean }> = {
  wormTooth: { name: 'Very Large Worm Tooth', desc: '+15% digging.', effect: 'dig', value: 0.15, rare: true },
  monocle: { name: "Stonejaw's Monocle", desc: '+20% knowledge.', effect: 'know', value: 0.2, rare: true },
  sporeCrown: { name: 'Spore Crown', desc: '+25% mushrooms.', effect: 'food', value: 0.25, rare: true },
  rustHeart: { name: 'Rust Heart', desc: '+25% squad attack.', effect: 'atk', value: 0.25, rare: true },
  luckyPebble: { name: 'Lucky Pebble', desc: '+10% gold.', effect: 'gold', value: 0.1, rare: false },
  spoon: { name: "Grandma's Spoon", desc: '+15% colony growth.', effect: 'growth', value: 0.15, rare: false },
  squeakyBoot: { name: 'Squeaky Boot', desc: '+10% squad HP.', effect: 'hp', value: 0.1, rare: false },
};
export const BOSS_RELICS = ['luckyPebble', 'spoon', 'squeakyBoot'];

// ---------------------------------------------------------------- gear
export const GEAR = {
  weapon: ['Rock on a Stick', 'Copper Sword', 'Iron Sword'],
  armor: ['Pot Lid', 'Copper Mail', 'Iron Plate'],
  metal: ['stone', 'copper', 'iron'] as ResId[],
  tierBase: [1, 4, 16],
  tierCost: [1, 3, 10],
  tierResearch: ['', 'copperSmelt', 'ironSmelt'],
};

// ---------------------------------------------------------------- research (per run)
export interface ResearchDef { id: string; name: string; desc: string; cost: Cost; req: (s: GameState) => boolean }
export const RESEARCH: ResearchDef[] = [
  { id: 'sharpPicks', name: 'Sharper Picks', desc: '+50% digging and mining.', cost: { knowledge: 15, stone: 50 }, req: () => true },
  { id: 'compost', name: 'Mushroom Compost', desc: '+50% mushrooms.', cost: { knowledge: 20 }, req: () => true },
  { id: 'copperSmelt', name: 'Copper Smelting', desc: 'Unlocks the Forge floor and copper gear.', cost: { knowledge: 30, copper: 20 }, req: (s) => s.run.depth >= 8 },
  { id: 'drill', name: 'Drill Training', desc: 'Unlocks the Fighter class.', cost: { knowledge: 40 }, req: (s) => s.run.maxZone >= 3 },
  { id: 'bunkBeds', name: 'Bunk Beds', desc: 'Bunkhouses hold 50% more.', cost: { knowledge: 50, stone: 150 }, req: () => true },
  { id: 'medicine', name: 'Field Medicine', desc: 'Unlocks the Cleric class.', cost: { knowledge: 90, food: 100 }, req: (s) => s.run.maxZone >= 5 },
  { id: 'haggling', name: 'Haggling', desc: '+50% gold.', cost: { knowledge: 120, gold: 50 }, req: (s) => s.run.maxZone >= 4 },
  { id: 'indexCards', name: 'Index Cards', desc: '+50% knowledge.', cost: { knowledge: 100 }, req: () => true },
  { id: 'masonry', name: 'Masonry', desc: 'Floors cost 25% less.', cost: { knowledge: 150, stone: 300 }, req: (s) => s.run.depth >= 12 },
  { id: 'arcane', name: 'Arcane Studies', desc: 'Unlocks the Wizard class.', cost: { knowledge: 300, copper: 100 }, req: (s) => s.run.maxZone >= 9 },
  { id: 'deepPicks', name: 'Deep-Core Picks', desc: '+100% digging and mining.', cost: { knowledge: 400, copper: 200 }, req: (s) => s.run.depth >= 20 },
  { id: 'ironSmelt', name: 'Iron Smelting', desc: 'Unlocks iron gear.', cost: { knowledge: 800, iron: 30 }, req: (s) => s.run.depth >= 35 },
];

// ---------------------------------------------------------------- divine tree (permanent)
export interface DivineDef { id: string; name: string; desc: string; base: number; growth: number; max?: number }
export const DIVINE: DivineDef[] = [
  { id: 'picks', name: 'Blessed Picks', desc: '+25% digging and mining per level.', base: 2, growth: 1.6 },
  { id: 'harvest', name: 'Bountiful Harvest', desc: '+25% mushrooms per level.', base: 2, growth: 1.6 },
  { id: 'fertile', name: 'Fertile Burrows', desc: '+20% growth and +3 max colonists per level.', base: 2, growth: 1.6 },
  { id: 'fervor', name: 'Divine Fervor', desc: '+20% squad attack per level.', base: 3, growth: 1.6 },
  { id: 'stoneskin', name: 'Stoneskin', desc: '+20% squad HP per level.', base: 3, growth: 1.6 },
  { id: 'finger', name: 'Divine Finger', desc: 'Your taps dig twice as hard per level.', base: 4, growth: 1.8 },
  { id: 'wisdom', name: 'Ancient Wisdom', desc: '+25% knowledge per level.', base: 4, growth: 1.6 },
  { id: 'greed', name: 'Holy Greed', desc: '+25% gold per level.', base: 4, growth: 1.6 },
  { id: 'headstart', name: 'Head Start', desc: 'Start each run with 100 stone and 50 mushrooms per level.', base: 3, growth: 1.7 },
  { id: 'memory', name: 'Long Memory', desc: '+4 hours of offline progress per level.', base: 5, growth: 2, max: 10 },
  { id: 'reliquary', name: 'Reliquary Slot', desc: 'Keep one more relic when you prestige.', base: 20, growth: 3, max: 5 },
];

// ---------------------------------------------------------------- races & gods
export type RaceId = 'dwarf' | 'goblin';
export const RACES: Record<RaceId, { name: string; desc: string }> = {
  dwarf: { name: 'Hill Dwarves', desc: '+25% digging, +10% squad HP. Reliable. Beardy.' },
  goblin: { name: 'Unionized Goblins', desc: '+40% to all jobs, but they take a mandatory 20s Union Break every 2 minutes.' },
};
export type GodId = 'forge' | 'snorg' | 'pebble';
export const GODS: Record<GodId, { name: string; desc: string }> = {
  forge: { name: 'Old Hammerbeard, the Forge-Father', desc: 'Gear is 25% more effective.' },
  snorg: { name: 'Snorg, God of Snacks', desc: '+50% mushrooms, +25% colony growth.' },
  pebble: { name: 'Pebble, God of Rocks', desc: 'Double stone. Pebble does not care about anything else.' },
};

// ---------------------------------------------------------------- achievements
const lt = (s: GameState, k: string) => s.meta.lifetime[k] ?? 0;
const builtCount = (s: GameState) => s.run.floors.filter(Boolean).length;
export interface AchDef { id: string; name: string; desc: string; check: (s: GameState) => boolean }
export const ACHIEVEMENTS: AchDef[] = [
  { id: 'dig1', name: 'First Scoop', desc: 'Dig your first level.', check: (s) => s.run.depth >= 1 },
  { id: 'dig10', name: 'Getting Somewhere', desc: 'Reach depth 10.', check: (s) => s.run.depth >= 10 },
  { id: 'dig25', name: 'Deep Thoughts', desc: 'Reach depth 25.', check: (s) => s.run.depth >= 25 },
  { id: 'dig50', name: 'Hello Down There', desc: 'Reach depth 50.', check: (s) => s.run.depth >= 50 },
  { id: 'pop10', name: 'Cozy Crowd', desc: 'Have 10 colonists.', check: (s) => s.run.pop >= 10 },
  { id: 'pop50', name: 'Small Town Energy', desc: 'Have 50 colonists.', check: (s) => s.run.pop >= 50 },
  { id: 'pop150', name: 'Bustling Burrow', desc: 'Have 150 colonists.', check: (s) => s.run.pop >= 150 },
  { id: 'floor5', name: 'Interior Decorator', desc: 'Build 5 floors.', check: (s) => builtCount(s) >= 5 },
  { id: 'floorAll', name: 'Full Set', desc: 'Have one of every floor type.', check: (s) => FLOOR_IDS.every((f) => s.run.floors.some((x) => x?.type === f)) },
  { id: 'floorLv5', name: 'Renovator', desc: 'Upgrade a floor to level 5.', check: (s) => s.run.floors.some((f) => (f?.level ?? 0) >= 5) },
  { id: 'kill1', name: 'Bonk', desc: 'Defeat a monster.', check: (s) => lt(s, 'kills') >= 1 },
  { id: 'kill100', name: 'Pest Control', desc: 'Defeat 100 monsters.', check: (s) => lt(s, 'kills') >= 100 },
  { id: 'kill1000', name: 'Exterminator', desc: 'Defeat 1,000 monsters.', check: (s) => lt(s, 'kills') >= 1000 },
  { id: 'zone5', name: 'Spelunker', desc: 'Reach Expedition zone 5.', check: (s) => s.run.maxZone >= 5 },
  { id: 'zone10', name: 'Cave Diver', desc: 'Reach Expedition zone 10.', check: (s) => s.run.maxZone >= 10 },
  { id: 'zone20', name: 'Abyss Tourist', desc: 'Reach Expedition zone 20.', check: (s) => s.run.maxZone >= 20 },
  { id: 'guard1', name: 'Worm Wrangler', desc: 'Defeat The Very Large Worm.', check: (s) => s.run.guardians.includes(0) },
  { id: 'guard2', name: 'Knight Takes Rook', desc: 'Defeat Sir Stonejaw.', check: (s) => s.run.guardians.includes(1) },
  { id: 'guard3', name: 'Fungicide', desc: 'Defeat Mother Mycelia.', check: (s) => s.run.guardians.includes(2) },
  { id: 'guard4', name: 'Tetanus Shot', desc: 'Defeat Grand Rustmaw.', check: (s) => s.run.guardians.includes(3) },
  { id: 'relic1', name: 'Ooh, Shiny', desc: 'Find a relic.', check: (s) => s.meta.relicsFound.length >= 1 },
  { id: 'stone1k', name: 'Rock Collector', desc: 'Mine 1,000 stone in total. (Someone noticed.)', check: (s) => lt(s, 'res.stone') >= 1000 },
  { id: 'stone100k', name: 'Rock Hoarder', desc: 'Mine 100,000 stone in total.', check: (s) => lt(s, 'res.stone') >= 1e5 },
  { id: 'gold1k', name: 'Pocket Change', desc: 'Earn 1,000 gold in total.', check: (s) => lt(s, 'res.gold') >= 1000 },
  { id: 'tap100', name: 'Hands-On Deity', desc: 'Tap the dig front 100 times.', check: (s) => lt(s, 'taps') >= 100 },
  { id: 'tap1000', name: 'Divine Carpal Tunnel', desc: 'Tap the dig front 1,000 times.', check: (s) => lt(s, 'taps') >= 1000 },
  { id: 'research5', name: 'Bookworm', desc: 'Complete 5 research projects in one run.', check: (s) => s.run.research.length >= 5 },
  { id: 'items50', name: 'Pocket Lint', desc: 'Collect 50 monster items in total.', check: (s) => lt(s, 'items') >= 50 },
  { id: 'wipe1', name: 'Tactical Retreat', desc: 'Have your squad get bonked.', check: (s) => lt(s, 'wipes') >= 1 },
  { id: 'unionBreak', name: 'Solidarity', desc: 'Experience a Union Break.', check: (s) => lt(s, 'unionBreaks') >= 1 },
  { id: 'prestige1', name: 'Born Again Digger', desc: 'Prestige for the first time.', check: (s) => s.meta.prestiges >= 1 },
  { id: 'prestige5', name: 'Serial Delver', desc: 'Prestige 5 times.', check: (s) => s.meta.prestiges >= 5 },
];
export const ACH_BONUS = 0.02; // +2% to all production per achievement
