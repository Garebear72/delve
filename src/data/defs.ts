// All game content lives here as data. Add content by adding entries.
import type { GameState } from '../game/state';

type Cost = Partial<Record<ResId, number>>;

// ---------------------------------------------------------------- resources
export type ResId = 'food' | 'stone' | 'copper' | 'iron' | 'crystal' | 'mithril' | 'gold' | 'knowledge';
export const RES_IDS: ResId[] = ['food', 'stone', 'copper', 'iron', 'crystal', 'mithril', 'gold', 'knowledge'];
/** Ores miners haul up once they dig into the biome that holds them (rate per miner, before bonuses). */
export const ORES: { res: ResId; biome: number; rate: number }[] = [
  { res: 'copper', biome: 1, rate: 0.12 },
  { res: 'iron', biome: 3, rate: 0.05 },
  { res: 'crystal', biome: 5, rate: 0.03 },
  { res: 'mithril', biome: 6, rate: 0.015 },
];
export const RESOURCES: Record<ResId, { name: string; icon: string; capped: boolean }> = {
  food: { name: 'Mushrooms', icon: 'i_food', capped: true },
  stone: { name: 'Stone', icon: 'i_stone', capped: true },
  copper: { name: 'Copper', icon: 'i_copper', capped: true },
  iron: { name: 'Iron', icon: 'i_iron', capped: true },
  crystal: { name: 'Crystal', icon: 'i_crystal', capped: true },
  mithril: { name: 'Mithril', icon: 'i_mithril', capped: true },
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
export type FloorId = 'bunk' | 'farm' | 'storage' | 'tavern' | 'barracks' | 'library' | 'forge' | 'shrine' | 'smeltery' | 'treasury' | 'arena';
export const FLOOR_IDS: FloorId[] = ['bunk', 'farm', 'storage', 'tavern', 'barracks', 'library', 'forge', 'shrine', 'smeltery', 'treasury', 'arena'];
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
  treasury: {
    name: 'Treasury', desc: '+25% gold per level.', cost: { stone: 400, gold: 300 }, color: '#4a3f1c',
    props: ['chest', 'chest'], unlock: (s) => s.run.maxZone >= 10, unlockText: 'Reach Expedition zone 10',
  },
  arena: {
    name: 'Training Grounds', desc: '+15% squad damage and HP per level.', cost: { stone: 600, iron: 40 }, color: '#4a3a2e',
    props: ['dummy', 'flag', 'dummy'], unlock: (s) => s.run.maxZone >= 15, unlockText: 'Reach Expedition zone 15',
  },
  smeltery: {
    name: 'Smeltery', desc: '+40% copper, iron, crystal and mithril per level.', cost: { stone: 800, iron: 60 }, color: '#55301e',
    props: ['fire', 'crate', 'fire'], unlock: (s) => s.run.depth >= 38, unlockText: 'Dig to depth 38',
  },
};
// Neighbouring floors that boost each other (+25% each).
export const ADJACENCY: [FloorId, FloorId][] = [
  ['tavern', 'barracks'], ['storage', 'forge'], ['farm', 'tavern'], ['library', 'shrine'], ['bunk', 'tavern'],
  ['smeltery', 'forge'], ['treasury', 'storage'], ['arena', 'barracks'],
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
  { id: 'magma', name: 'Magma Rift', from: 55, colors: ['#4a2a24', '#3a201c', '#5c342b'], speck: '#df7126', floorMult: { forge: 2, farm: 0.5, shrine: 1.3, smeltery: 1.5 } },
  { id: 'crystal', name: 'Crystal Grotto', from: 80, colors: ['#3a3352', '#2e2944', '#4a4166'], speck: '#c9a7ff', floorMult: { library: 1.5, shrine: 1.3, farm: 0.6, treasury: 1.2 } },
  { id: 'mithril', name: 'Mithril Deeps', from: 110, colors: ['#3b4752', '#2f3a44', '#4b5966'], speck: '#e8f4ff', floorMult: { forge: 1.6, smeltery: 1.6, barracks: 1.25, farm: 0.6 } },
  { id: 'sea', name: 'The Sunless Sea', from: 145, colors: ['#1f3b4d', '#183040', '#28495e'], speck: '#5fcde4', floorMult: { farm: 1.8, tavern: 1.4, storage: 0.7, forge: 0.6 } },
  { id: 'bones', name: 'Bone Catacombs', from: 185, colors: ['#4a4440', '#3b3633', '#5a534e'], speck: '#f3ead8', floorMult: { shrine: 1.7, arena: 1.5, farm: 0.5, tavern: 0.8 } },
  { id: 'core', name: 'The Hollow Core', from: 230, colors: ['#5a2a1a', '#46200f', '#6e3820'], speck: '#fbf236', floorMult: { forge: 2.5, treasury: 1.6, smeltery: 2, farm: 0.4 } },
];
// GUARDIANS[i] seals the entrance to BIOMES[i + 1].
export const GUARDIANS: { name: string; sprite: string; pal: Record<string, string>; scale: number; hp: number; atk: number; relic: string }[] = [
  { name: 'The Very Large Worm', sprite: 'worm', pal: {}, scale: 6, hp: 1500, atk: 22, relic: 'wormTooth' },
  { name: 'Sir Stonejaw, Golem Knight', sprite: 'golem', pal: {}, scale: 6, hp: 25000, atk: 160, relic: 'monocle' },
  { name: 'Mother Mycelia', sprite: 'shroom', pal: { r: '#8f56c9', w: '#fbf236' }, scale: 8, hp: 400000, atk: 1800, relic: 'sporeCrown' },
  { name: 'Grand Rustmaw', sprite: 'troll', pal: { G: '#c27b3e', B: '#7a3e1a' }, scale: 7, hp: 8e6, atk: 25000, relic: 'rustHeart' },
  { name: 'The Glimmerwyrm', sprite: 'wyrm', pal: { g: '#c9a7ff', G: '#8f56c9', y: '#ffffff' }, scale: 6, hp: 8e7, atk: 1.8e5, relic: 'prism' },
  { name: 'Grumbleforge, the Duergar King', sprite: 'golem', pal: { M: '#3b4752', m: '#9badb7', l: '#df7126' }, scale: 7, hp: 7e8, atk: 1.1e6, relic: 'mithrilCrown' },
  { name: 'Admiral Squidbeard', sprite: 'squid', pal: {}, scale: 7, hp: 8e9, atk: 8e6, relic: 'inkPot' },
  { name: 'The Lich Who Lost Their Keys', sprite: 'lich', pal: {}, scale: 7, hp: 9e10, atk: 6e7, relic: 'phylactery' },
  { name: 'The Sleepy Tarrasque', sprite: 'troll', pal: { G: '#6e3820', B: '#3a201c', y: '#fbf236', w: '#f3ead8' }, scale: 9, hp: 1.4e12, atk: 5e8, relic: 'tarrasqueScale' },
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
export const LATE_ZONE = 30; // past this zone enemies grow more gently...
export const ENEMY_HP_LATE = 1.25; // ...×this HP per zone
export const ENEMY_ATK_LATE = 1.2; // ...×this attack per zone
// Mine level toughness: LEVEL_HP × LEVEL_HP_GROWTH^level, gentler (LEVEL_HP_DEEP) past DEEP_FROM.
export const LEVEL_HP = 650;
export const LEVEL_HP_GROWTH = 1.2;
export const LEVEL_HP_DEEP = 1.15;
export const DEEP_FROM = 55;
// Divine Favor grows exponentially past depth 35 / zone 20 (×this per level / zone).
export const FAVOR_DEEP = 1.008;
export const FAVOR_ZONE = 1.01;
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

/** Zone enemies. `from` = first zone they appear; bosses (`boss: true`) guard the last cell of a zone. */
export const ENEMIES: Record<string, { name: string; sprite: string; pal: Record<string, string>; item: string; from: number; boss?: boolean }> = {
  rat: { name: 'Cave Rat', sprite: 'rat', pal: {}, item: 'ratTail', from: 1 },
  slime: { name: 'Slime', sprite: 'slime', pal: {}, item: 'jelly', from: 1 },
  bat: { name: 'Grumpy Bat', sprite: 'bat', pal: {}, item: 'batWing', from: 3 },
  goblin: { name: 'Wild Goblin', sprite: 'goblin', pal: {}, item: 'sock', from: 6 },
  kobold: { name: 'Kobold', sprite: 'kobold', pal: {}, item: 'button', from: 7 },
  shroom: { name: 'Myconid', sprite: 'shroom', pal: {}, item: 'spore', from: 10 },
  blueslime: { name: 'Gelatinous Cube-ish', sprite: 'slime', pal: { g: '#5fcde4', G: '#306082' }, item: 'jelly', from: 13 },
  skeleton: { name: 'Skeleton Intern', sprite: 'skeleton', pal: {}, item: 'funnyBone', from: 15 },
  mimic: { name: 'Mimic (Probably)', sprite: 'mimic', pal: {}, item: 'mimicTongue', from: 19 },
  eye: { name: 'Beholder-ish', sprite: 'eye', pal: {}, item: 'glassEye', from: 24 },
  owlbear: { name: 'Owlbear Cub', sprite: 'owlbear', pal: {}, item: 'owlFeather', from: 29 },
  wraith: { name: 'Wraith on Lunch Break', sprite: 'wraith', pal: {}, item: 'ectoplasm', from: 34 },
  drake: { name: 'Crystal Drake', sprite: 'wyrm', pal: { g: '#c9a7ff', G: '#8f56c9' }, item: 'drakeScale', from: 40 },
  duergar: { name: 'Duergar Taxman', sprite: 'kobold', pal: { o: '#7d8a96', R: '#3b4752', y: '#df7126' }, item: 'taxForm', from: 47 },
  squidling: { name: 'Squidling', sprite: 'squid', pal: { p: '#5fcde4', P: '#306082' }, item: 'inkSac', from: 55 },
  ghoul: { name: 'Ghoul in a Bathrobe', sprite: 'skeleton', pal: { w: '#9db089', i: '#d6a3c2' }, item: 'slipper', from: 63 },
  imp: { name: 'Magma Imp', sprite: 'kobold', pal: { o: '#d95763', R: '#fbf236', y: '#ffffff' }, item: 'emberCoal', from: 72 },
  troll: { name: 'Cave Troll', sprite: 'troll', pal: {}, item: 'toenail', from: 1, boss: true },
  ogre: { name: 'Ogre Magistrate', sprite: 'troll', pal: { G: '#8f56c9', B: '#3b2a5c' }, item: 'gavel', from: 15, boss: true },
  dragon: { name: 'Elder Dragon (Junior)', sprite: 'wyrm', pal: { g: '#d95763', G: '#9e2a3a', y: '#fbf236' }, item: 'dragonEgg', from: 35, boss: true },
  kraken: { name: 'Kraken (Pocket Edition)', sprite: 'squid', pal: { p: '#37946e', P: '#1f5a43' }, item: 'krakenTooth', from: 60, boss: true },
};

export const ITEMS: Record<string, { name: string; desc: string }> = {
  ratTail: { name: 'Rat Tail', desc: 'Still wiggles a bit.' },
  jelly: { name: 'Slime Jelly', desc: 'Goes great on toast, allegedly.' },
  batWing: { name: 'Bat Wing', desc: 'Leathery and judgemental.' },
  sock: { name: 'Goblin Sock', desc: 'Never in pairs. Never clean.' },
  button: { name: 'Shiny Button', desc: 'Kobolds trade these like currency.' },
  spore: { name: 'Spore Puff', desc: 'Do not sneeze near it.' },
  toenail: { name: 'Troll Toenail', desc: 'Surprisingly valuable. Surprisingly large.' },
  funnyBone: { name: 'Funny Bone', desc: "It isn't humerus. It's a femur." },
  mimicTongue: { name: 'Mimic Tongue', desc: 'Pretending to be a doormat. Do not wipe your feet.' },
  glassEye: { name: 'Glass Eye', desc: 'Still watching. Still judging.' },
  owlFeather: { name: 'Owlbear Feather', desc: 'Half feather, half fur, fully confusing.' },
  ectoplasm: { name: 'Ectoplasm', desc: 'Cold, wobbly, faintly minty.' },
  drakeScale: { name: 'Drake Scale', desc: 'Rings like a bell when flicked.' },
  taxForm: { name: 'Duergar Tax Form', desc: 'Form 27-B: Declaration of Pebbles Owed.' },
  inkSac: { name: 'Ink Sac', desc: 'Great for writing angry letters.' },
  slipper: { name: 'Fuzzy Slipper', desc: 'The ghoul wants it back. The ghoul can ask nicely.' },
  emberCoal: { name: 'Ember Coal', desc: 'Never goes out. Makes excellent toast.' },
  gavel: { name: 'Ogre Gavel', desc: 'ORDER. ORDER IN THE CAVE.' },
  dragonEgg: { name: 'Dragon Egg (Probably Decorative)', desc: 'It is warm. It is ticking. That is fine.' },
  krakenTooth: { name: 'Kraken Tooth', desc: 'Tiny. The kraken was also tiny.' },
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
  prism: { name: 'Glimmerwyrm Prism', desc: '+40% knowledge.', effect: 'know', value: 0.4, rare: true },
  mithrilCrown: { name: 'Mithril Crown', desc: '+40% digging.', effect: 'dig', value: 0.4, rare: true },
  inkPot: { name: "Squidbeard's Ink Pot", desc: '+50% mushrooms.', effect: 'food', value: 0.5, rare: true },
  phylactery: { name: 'Spare Phylactery', desc: '+50% squad HP.', effect: 'hp', value: 0.5, rare: true },
  tarrasqueScale: { name: 'Tarrasque Scale', desc: '+60% squad attack.', effect: 'atk', value: 0.6, rare: true },
  mapScrap: { name: 'Torn Treasure Map', desc: '+10% digging.', effect: 'dig', value: 0.1, rare: false },
  charm: { name: 'Charm Bracelet', desc: '+10% squad attack.', effect: 'atk', value: 0.1, rare: false },
  bellows: { name: 'Tiny Bellows', desc: '+15% knowledge.', effect: 'know', value: 0.15, rare: false },
};
export const BOSS_RELICS = ['luckyPebble', 'spoon', 'squeakyBoot', 'mapScrap', 'charm', 'bellows'];

// ---------------------------------------------------------------- gear
export const GEAR = {
  weapon: ['Rock on a Stick', 'Copper Sword', 'Iron Sword', 'Crystal Cleaver', 'Mithril Greataxe'],
  armor: ['Pot Lid', 'Copper Mail', 'Iron Plate', 'Crystal Scale', 'Mithril Mail'],
  metal: ['stone', 'copper', 'iron', 'crystal', 'mithril'] as ResId[],
  tierBase: [1, 4, 16, 80, 400],
  tierCost: [1, 3, 10, 30, 100],
  tierResearch: ['', 'copperSmelt', 'ironSmelt', 'crystalLens', 'mithrilSmelt'],
};

// ---------------------------------------------------------------- research (per run)
/** Research multipliers (x(1+v), stacking multiplicatively) used by calc.ts via researchMult(). */
export type ResearchStat = 'dig' | 'food' | 'know' | 'gold' | 'ore' | 'stone' | 'dmg' | 'hp' | 'favor' | 'regroup';
export interface ResearchDef {
  id: string; name: string; desc: string; cost: Cost; req: (s: GameState) => boolean;
  effects?: Partial<Record<ResearchStat, number>>; squadCap?: number; bunk?: number;
}
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
  { id: 'warDrums', name: 'War Drums', desc: '+50% squad damage.', cost: { knowledge: 600, gold: 1500 }, req: (s) => s.run.maxZone >= 14, effects: { dmg: 0.5 } },
  { id: 'riveted', name: 'Riveted Plate', desc: '+50% squad HP.', cost: { knowledge: 1000, iron: 150 }, req: (s) => s.run.maxZone >= 18, effects: { hp: 0.5 } },
  { id: 'glowcaps', name: 'Glowcap Cultivation', desc: '+100% mushrooms.', cost: { knowledge: 1500 }, req: (s) => s.run.depth >= 36, effects: { food: 1 } },
  { id: 'furnace', name: 'Roaring Furnaces', desc: '+100% copper, iron, crystal and mithril.', cost: { knowledge: 2000, stone: 2500 }, req: (s) => s.run.depth >= 40, effects: { ore: 1 } },
  { id: 'blastMining', name: 'Blast Mining', desc: '+150% digging and stone.', cost: { knowledge: 3000, iron: 300 }, req: (s) => s.run.depth >= 45, effects: { dig: 1.5, stone: 1.5 } },
  { id: 'archive', name: 'Grand Archive', desc: '+100% knowledge.', cost: { knowledge: 4000, gold: 8000 }, req: (s) => s.run.depth >= 50, effects: { know: 1 } },
  { id: 'tactics', name: 'Squad Tactics', desc: '+4 squad size.', cost: { knowledge: 3000, gold: 10000 }, req: (s) => s.run.maxZone >= 24, squadCap: 4 },
  { id: 'deepHalls', name: 'Hollowed Halls', desc: 'Bunkhouses hold 4 more per level.', cost: { knowledge: 6000, stone: 4000 }, req: (s) => s.run.depth >= 60, bunk: 4 },
  { id: 'necro', name: 'Polite Necromancy', desc: 'Squads regroup 3x faster. Nobody asks how.', cost: { knowledge: 9000, gold: 30000 }, req: (s) => s.run.maxZone >= 32, effects: { regroup: 2 } },
  { id: 'crystalLens', name: 'Crystal Lenses', desc: 'Unlocks crystal gear. +50% knowledge.', cost: { knowledge: 12000, crystal: 60 }, req: (s) => s.run.depth >= 80, effects: { know: 0.5 } },
  { id: 'crystalDrills', name: 'Crystal-Tipped Drills', desc: '+200% digging.', cost: { knowledge: 25000, crystal: 200 }, req: (s) => s.run.depth >= 88, effects: { dig: 2 } },
  { id: 'runeforge', name: 'Runeforging', desc: '+100% squad damage.', cost: { knowledge: 40000, crystal: 300 }, req: (s) => s.run.maxZone >= 42, effects: { dmg: 1 } },
  { id: 'mithrilSmelt', name: 'Mithril Smelting', desc: 'Unlocks mithril gear.', cost: { knowledge: 1.2e5, mithril: 80 }, req: (s) => s.run.depth >= 110 },
  { id: 'mithrilPicks', name: 'Mithril Picks', desc: '+300% digging.', cost: { knowledge: 2.5e5, mithril: 300 }, req: (s) => s.run.depth >= 118, effects: { dig: 3 } },
  { id: 'wardstones', name: 'Wardstones', desc: '+150% squad HP.', cost: { knowledge: 4e5, mithril: 500 }, req: (s) => s.run.maxZone >= 52, effects: { hp: 1.5 } },
  { id: 'tideFarms', name: 'Tide Farms', desc: '+200% mushrooms and +100% gold.', cost: { knowledge: 1e6 }, req: (s) => s.run.depth >= 150, effects: { food: 2, gold: 1 } },
  { id: 'starCharts', name: 'Star Charts', desc: '+50% Divine Favor.', cost: { knowledge: 2e6, crystal: 3000 }, req: (s) => s.run.depth >= 160, effects: { favor: 0.5 } },
  { id: 'boneArmor', name: 'Ossuary Armor', desc: '+200% squad HP and damage.', cost: { knowledge: 6e6, mithril: 3000 }, req: (s) => s.run.depth >= 190, effects: { hp: 2, dmg: 2 } },
  { id: 'coreTap', name: 'Core Tap', desc: '+500% digging and ore.', cost: { knowledge: 2e7, mithril: 8000 }, req: (s) => s.run.depth >= 235, effects: { dig: 5, ore: 5 } },
];

// ---------------------------------------------------------------- divine tree (permanent)
/**
 * Divine Tree (permanent, bought with Favor). `mult` upgrades compound: each level multiplies by (1 + mult),
 * so Favor keeps paying off however deep you go. calc.ts reads them through divMult().
 */
export interface DivineDef { id: string; name: string; desc: string; base: number; growth: number; max?: number; mult?: number }
export const DIVINE: DivineDef[] = [
  { id: 'picks', name: 'Blessed Picks', desc: 'Digging and mining ×1.15 per level (compounds).', base: 2, growth: 1.8, mult: 0.15 },
  { id: 'harvest', name: 'Bountiful Harvest', desc: 'Mushrooms ×1.15 per level (compounds).', base: 2, growth: 1.8, mult: 0.15 },
  { id: 'fertile', name: 'Fertile Burrows', desc: 'Colony growth ×1.1 and +3 max colonists per level.', base: 2, growth: 1.8, mult: 0.1 },
  { id: 'fervor', name: 'Divine Fervor', desc: 'Squad attack ×1.15 per level (compounds).', base: 3, growth: 1.8, mult: 0.15 },
  { id: 'stoneskin', name: 'Stoneskin', desc: 'Squad HP ×1.15 per level (compounds).', base: 3, growth: 1.8, mult: 0.15 },
  { id: 'finger', name: 'Divine Finger', desc: 'Your taps dig twice as hard per level.', base: 4, growth: 1.8, mult: 1 },
  { id: 'wisdom', name: 'Ancient Wisdom', desc: 'Knowledge ×1.15 per level (compounds).', base: 4, growth: 1.8, mult: 0.15 },
  { id: 'greed', name: 'Holy Greed', desc: 'Gold ×1.15 per level (compounds).', base: 4, growth: 1.8, mult: 0.15 },
  { id: 'veins', name: 'Glittering Veins', desc: 'Stone and every ore ×1.15 per level (compounds).', base: 5, growth: 1.8, mult: 0.15 },
  { id: 'giantbane', name: 'Giantbane', desc: 'Damage against zone bosses and guardians ×1.15 per level.', base: 6, growth: 1.85, mult: 0.15 },
  { id: 'headstart', name: 'Head Start', desc: 'Start each run with 100 stone and 50 mushrooms per level.', base: 3, growth: 1.7 },
  { id: 'ancestors', name: 'Ancestral Halls', desc: 'Start each run with 2 more colonists per level.', base: 8, growth: 1.9, max: 10 },
  { id: 'tactics', name: 'Divine Tactics', desc: '+1 squad size per level.', base: 10, growth: 2.2, max: 10 },
  { id: 'memory', name: 'Long Memory', desc: '+4 hours of offline progress per level.', base: 5, growth: 2, max: 10 },
  { id: 'reliquary', name: 'Reliquary Slot', desc: 'Keep one more relic when you prestige.', base: 20, growth: 3, max: 5 },
  { id: 'fortune', name: "Fortune's Favor", desc: '+15% Curio luck in mini-games per level.', base: 25, growth: 2, max: 10 },
];

// ---------------------------------------------------------------- races & gods
export type RaceId = 'dwarf' | 'goblin' | 'gnome' | 'kobold';
export const RACES: Record<RaceId, { name: string; desc: string; unlockText: string }> = {
  dwarf: { name: 'Hill Dwarves', desc: '+25% digging, +10% squad HP. Reliable. Beardy.', unlockText: '' },
  goblin: { name: 'Unionized Goblins', desc: '+40% to all jobs, but they take a mandatory 20s Union Break every 2 minutes.', unlockText: 'Prestige once' },
  gnome: { name: 'Tinkering Gnomes', desc: '+60% knowledge, research costs 30% less, but -20% squad HP. Mostly hats.', unlockText: 'Prestige 3 times' },
  kobold: { name: 'Kobold Hoarders', desc: 'Double storage and +30% gold, but -10% digging. Shiny!', unlockText: 'Reach depth 80' },
};
export type GodId = 'forge' | 'snorg' | 'pebble' | 'krog' | 'moss';
export const GODS: Record<GodId, { name: string; desc: string; unlockText: string }> = {
  forge: { name: 'Old Hammerbeard, the Forge-Father', desc: 'Gear is 25% more effective.', unlockText: '' },
  snorg: { name: 'Snorg, God of Snacks', desc: '+50% mushrooms, +25% colony growth.', unlockText: 'Prestige once' },
  pebble: { name: 'Pebble, God of Rocks', desc: 'Double stone. Pebble does not care about anything else.', unlockText: 'Mine 1,000 stone' },
  krog: { name: 'Krog, God of Bonking', desc: '+40% squad damage, but -15% digging. BONK.', unlockText: 'Defeat Mother Mycelia' },
  moss: { name: 'Grandmother Moss, Goddess of Naps', desc: '+8 hours of offline progress and +25% job output while you leave the colony alone.', unlockText: 'Prestige 5 times' },
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
  { id: 'dice100', name: 'Regular', desc: 'Roll Goblin Dice 100 times.', check: (s) => lt(s, 'dice.rolls') >= 100 },
  { id: 'diceStreak5', name: "Goblin's Nemesis", desc: 'Win 5 dice rolls in a row.', check: (s) => lt(s, 'dice.bestStreak') >= 5 },
  { id: 'curio1', name: 'Knick-Knack', desc: 'Find a Curio.', check: (s) => lt(s, 'curios') >= 1 },
  { id: 'curio10', name: 'Cabinet of Curiosities', desc: 'Find 10 Curios in total.', check: (s) => lt(s, 'curios') >= 10 },
  { id: 'prestige5', name: 'Serial Delver', desc: 'Prestige 5 times.', check: (s) => s.meta.prestiges >= 5 },
  { id: 'prestige10', name: 'Groundhog Delve', desc: 'Prestige 10 times.', check: (s) => s.meta.prestiges >= 10 },
  { id: 'prestige25', name: 'It Never Ends', desc: 'Prestige 25 times.', check: (s) => s.meta.prestiges >= 25 },
  { id: 'dig80', name: 'Shiny Rocks', desc: 'Reach the Crystal Grotto (depth 80).', check: (s) => s.run.depth >= 80 },
  { id: 'dig110', name: 'Mithril, Actually', desc: 'Reach the Mithril Deeps (depth 110).', check: (s) => s.run.depth >= 110 },
  { id: 'dig145', name: 'Bring a Towel', desc: 'Reach the Sunless Sea (depth 145).', check: (s) => s.run.depth >= 145 },
  { id: 'dig185', name: 'Bone Zone', desc: 'Reach the Bone Catacombs (depth 185).', check: (s) => s.run.depth >= 185 },
  { id: 'dig230', name: 'Journey to the Centre', desc: 'Reach the Hollow Core (depth 230).', check: (s) => s.run.depth >= 230 },
  { id: 'zone30', name: 'Deep Expedition', desc: 'Reach Expedition zone 30.', check: (s) => s.run.maxZone >= 30 },
  { id: 'zone40', name: 'Off the Map', desc: 'Reach Expedition zone 40.', check: (s) => s.run.maxZone >= 40 },
  { id: 'zone60', name: 'Here Be Dragons (Junior)', desc: 'Reach Expedition zone 60.', check: (s) => s.run.maxZone >= 60 },
  { id: 'zone80', name: 'Legends Never Bonk', desc: 'Reach Expedition zone 80.', check: (s) => s.run.maxZone >= 80 },
  { id: 'guard5', name: 'Dragon Dentist', desc: 'Defeat the Glimmerwyrm.', check: (s) => s.run.guardians.includes(4) },
  { id: 'guard6', name: 'Regicide (Tax-Deductible)', desc: 'Defeat Grumbleforge.', check: (s) => s.run.guardians.includes(5) },
  { id: 'guard7', name: 'Calamari', desc: 'Defeat Admiral Squidbeard.', check: (s) => s.run.guardians.includes(6) },
  { id: 'guard8', name: 'Found Them!', desc: 'Defeat the Lich Who Lost Their Keys.', check: (s) => s.run.guardians.includes(7) },
  { id: 'guard9', name: 'Let Sleeping Tarrasques Lie', desc: 'Defeat the Sleepy Tarrasque.', check: (s) => s.run.guardians.includes(8) },
  { id: 'pop500', name: 'Under-Mountain Metropolis', desc: 'Have 500 colonists.', check: (s) => s.run.pop >= 500 },
  { id: 'pop2000', name: 'Dwarven Empire', desc: 'Have 2,000 colonists.', check: (s) => s.run.pop >= 2000 },
  { id: 'kill10k', name: 'Professional Bonker', desc: 'Defeat 10,000 monsters.', check: (s) => lt(s, 'kills') >= 1e4 },
  { id: 'kill100k', name: 'Monster Manual (Abridged)', desc: 'Defeat 100,000 monsters.', check: (s) => lt(s, 'kills') >= 1e5 },
  { id: 'gold1m', name: 'Dragon Hoard', desc: 'Earn 1,000,000 gold in total.', check: (s) => lt(s, 'res.gold') >= 1e6 },
  { id: 'crystal1', name: 'Crystal Clear', desc: 'Mine your first crystal.', check: (s) => lt(s, 'res.crystal') >= 1 },
  { id: 'mithril1', name: 'Truesilver', desc: 'Mine your first mithril.', check: (s) => lt(s, 'res.mithril') >= 1 },
  { id: 'gearTop', name: 'Fully Mithrilled', desc: 'Forge a Mithril Greataxe.', check: (s) => s.run.gear.wTier >= 4 },
  { id: 'research20', name: 'Big Brain Colony', desc: 'Complete 20 research projects in one run.', check: (s) => s.run.research.length >= 20 },
  { id: 'races', name: 'Melting Pot', desc: 'Unlock every race.', check: (s) => s.meta.races.length >= Object.keys(RACES).length },
  { id: 'gods', name: 'Pantheon Collector', desc: 'Unlock every god.', check: (s) => s.meta.gods.length >= Object.keys(GODS).length },
  { id: 'items500', name: 'Hoarder', desc: 'Collect 500 monster items in total.', check: (s) => lt(s, 'items') >= 500 },
  { id: 'relic5', name: 'Museum Curator', desc: 'Find 5 different relics.', check: (s) => s.meta.relicsFound.length >= 5 },
  { id: 'cavern1', name: 'Hole in the Wall', desc: 'Find a Hidden Cavern.', check: (s) => lt(s, 'caverns') >= 1 },
  { id: 'dungeon1', name: 'Dungeon Crawler', desc: 'Clear a Hidden Cavern.', check: (s) => lt(s, 'dungeons.cleared') >= 1 },
  { id: 'dungeon10', name: 'Professional Adventurer', desc: 'Clear 10 Hidden Caverns.', check: (s) => lt(s, 'dungeons.cleared') >= 10 },
  { id: 'dungeon50', name: 'The Caverns Fear You', desc: 'Clear 50 Hidden Caverns.', check: (s) => lt(s, 'dungeons.cleared') >= 50 },
  { id: 'heirloom1', name: 'Family Treasure', desc: 'Find an Heirloom.', check: (s) => lt(s, 'heirlooms') >= 1 },
  { id: 'plinko100', name: 'Pachinko Pro', desc: 'Drop 100 Plinko balls.', check: (s) => lt(s, 'plinko.drops') >= 100 },
  { id: 'plinkoJack', name: 'Edge Lord', desc: 'Land a ×5 Plinko slot.', check: (s) => lt(s, 'plinko.jackpots') >= 1 },
  { id: 'cartEnd', name: 'End of the Line', desc: 'Survive all four forks of a mine-cart ride.', check: (s) => lt(s, 'cart.finishes') >= 1 },
  { id: 'cartCrash', name: 'Health and Safety Violation', desc: 'Crash a mine cart.', check: (s) => lt(s, 'cart.crashes') >= 1 },
  { id: 'wheel10', name: 'Spin Doctor', desc: 'Spin the Wheel of the Gods 10 times.', check: (s) => lt(s, 'wheel.spins') >= 10 },
  { id: 'relicAll', name: 'Indiana Dwarf', desc: 'Find every relic.', check: (s) => s.meta.relicsFound.length >= Object.keys(RELICS).length },
];
export const ACH_BONUS = 0.02; // +2% to all production per achievement
