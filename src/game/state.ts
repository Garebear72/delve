import { ABILITIES, ASCEND, BIOMES, FLOORS, GODS, RACES } from '../data/defs';
import type { AbilityId, ClassId, FloorId, GodId, JobId, RaceId, ResId } from '../data/defs';
import type { SkillId } from '../data/skills';
import { CURIOS } from '../data/minigames';

export const SAVE_VERSION = 1;

export interface FloorSlot { type: FloorId; level: number }

export interface CombatState {
  zone: number;
  cell: number;
  enemyId: string;
  enemyHp: number;
  enemyMax: number;
  mode: 'zone' | 'guardian';
  guardian: number;
  alive: boolean;
  squad: Record<ClassId, number>;
  plan: Record<ClassId, number>;
  squadHp: number;
  regroup: number;
  farm: boolean;
  bossHold: boolean; // lost to this zone's boss: loop the normal enemies until the player retries
  holdT: number; // seconds on bossHold (Auto-Retry fires after 30)
  cry: number;
  cryCd: number;
  wall: number;
  wallCd: number;
  autoCast: boolean;
  swing: Record<ClassId, number>; // time since each class's last volley
  eSwing: number; // time since the enemy's last attack
  healT: number; // time since the last healing pulse
}

export interface RunState {
  race: RaceId;
  god: GodId;
  res: Record<ResId, number>;
  pop: number;
  starve: number; // seconds spent starving since a colonist last wandered off
  jobs: Record<JobId, number>;
  depth: number;
  dig: number;
  floors: (FloorSlot | null)[];
  gear: { wTier: number; wLvl: number; aTier: number; aLvl: number };
  research: string[];
  combatUnlocked: boolean;
  combat: CombatState;
  maxZone: number;
  guardians: number[];
  relics: string[];
  items: Record<string, number>;
  time: number;
  inBreak: boolean;
  seen: string[]; // unlock announcements already shown
  perks: Record<string, number>; // run perk ranks (reset every prestige)
  perkPoints: number; // run perk points earned this run
  perkRespecs: number;
  dice: DiceState;
  cart: CartState;
  boons: Record<string, number>; // Wheel of the Gods blessings this run (stacks)
  wheelSpins: number; // spins taken this run (the first WHEEL.freeSpins are free)
  plinkoPeg: [number, number]; // Plinko's golden peg [row, column]
  curiosFound: number; // mini-game Curios found this run (each lowers further Curio luck a little)
  caverns: number[]; // depths of Hidden Caverns found and not yet explored
  dungeon: DungeonState | null; // the cavern being explored, if any
}

export interface DungeonState {
  depth: number; // where the cavern was found (sets the boss)
  room: number; // rooms cleared (DUNGEON.rooms = boss room)
  hp: number; maxHp: number;
  doors: string[]; // room types behind this room's doors
  gold: number; // gold found so far (already added to your gold)
  found: string[]; // Heirlooms found this dungeon
  log: string[]; // newest first
  over: '' | 'won' | 'fled';
}

export interface CartState {
  pot: number; // gold riding in the cart (0 = not riding)
  step: number; // forks passed this ride
  path: ('sturdy' | 'rickety')[];
  luck: number; // Curio luck built up this ride
  result: '' | 'riding' | 'crash' | 'cashout' | 'end';
  rides: number;
}

export interface DiceState {
  pot: number; // gold riding on the table (0 = no bet)
  streak: number; // wins in a row this bet
  you: number[];
  gob: number[];
  result: '' | 'win' | 'lose' | 'boxcars' | 'cashout';
  rolls: number; // total rolls this run (also keys the dice animation)
}

export interface MetaState {
  favor: number;
  totalFavor: number;
  divine: Record<string, number>;
  prestiges: number;
  achievements: string[];
  lifetime: Record<string, number>;
  collection: Record<string, number>;
  bestiary: Record<string, number>;
  relicsFound: string[];
  reliquary: string[];
  bestDepth: number;
  bestZone: number;
  races: RaceId[];
  gods: GodId[];
  time: number;
  created: number;
  skills: Record<SkillId, number>; // XP per skill (permanent)
  alloc: Record<string, number>; // learned skill tree nodes and their ranks
  loadout: AbilityId[]; // equipped abilities
  curios: Record<string, number>; // Curios found (permanent), copies of each
  // Ascension (tier 2): resets Favor and the Divine Tree for Godsparks.
  sparks: number; // unspent Godsparks
  totalSparks: number;
  ascensions: number;
  ascFavor: number; // Favor earned since the last Ascension (sets the Godsparks)
  celestial: Record<string, number>; // Celestial Tree levels
  celOff: string[]; // switchable Celestial upgrades the player has turned off
}

export interface GameState {
  v: number;
  savedAt: number;
  run: RunState;
  meta: MetaState;
}

const zeroClasses = (): Record<ClassId, number> => ({ recruit: 0, fighter: 0, cleric: 0, wizard: 0 });

export function newCombat(): CombatState {
  return {
    zone: 1, cell: 0, enemyId: '', enemyHp: 0, enemyMax: 1, mode: 'zone', guardian: -1,
    alive: false, squad: zeroClasses(), plan: { ...zeroClasses(), recruit: 3 }, squadHp: 0, regroup: 0,
    farm: false, bossHold: false, holdT: 0, cry: 0, cryCd: 0, wall: 0, wallCd: 0, autoCast: false, swing: zeroClasses(), eSwing: 0, healT: 0,
  };
}

export function newRun(meta: MetaState, race: RaceId = 'dwarf', god: GodId = 'forge'): RunState {
  const hs = meta.divine.headstart ?? 0;
  // Running Start: begin deeper, with the guardians sealing the biomes above already beaten.
  const start = ASCEND.runningStart[(meta.celestial.start ?? 0) - 1] ?? 0;
  const guardians: number[] = [];
  for (let i = 1; i < BIOMES.length; i++) if (BIOMES[i].from <= start) guardians.push(i - 1);
  return {
    race, god,
    res: { food: 20 + hs * 50, stone: hs * 100, copper: 0, iron: 0, crystal: 0, mithril: 0, gold: 0, knowledge: 0 },
    pop: 2 + 2 * (meta.divine.ancestors ?? 0),
    starve: 0,
    jobs: { miner: 0, farmer: 0, scholar: 0 },
    depth: start, dig: 0, floors: new Array(start).fill(null),
    gear: { wTier: 0, wLvl: 0, aTier: 0, aLvl: 0 },
    research: [],
    combatUnlocked: false,
    combat: newCombat(),
    maxZone: 0,
    guardians,
    relics: [...meta.reliquary],
    items: {},
    time: 0,
    inBreak: false,
    seen: [],
    perks: {},
    perkPoints: 0,
    perkRespecs: 0,
    dice: { pot: 0, streak: 0, you: [], gob: [], result: '', rolls: 0 },
    cart: { pot: 0, step: 0, path: [], luck: 1, result: '', rides: 0 },
    boons: {},
    wheelSpins: 0,
    plinkoPeg: [4, 4],
    curiosFound: 0,
    caverns: [],
    dungeon: null,
  };
}

export function newMeta(): MetaState {
  return {
    favor: 0, totalFavor: 0, divine: {}, prestiges: 0, achievements: [], lifetime: {}, collection: {},
    bestiary: {}, relicsFound: [], reliquary: [], bestDepth: 0, bestZone: 0,
    races: ['dwarf'], gods: ['forge'], time: 0, created: Date.now(),
    skills: { combat: 0, digging: 0, colony: 0, handsOn: 0, handsOff: 0 },
    alloc: {},
    loadout: [],
    curios: {},
    sparks: 0, totalSparks: 0, ascensions: 0, ascFavor: 0, celestial: {}, celOff: [],
  };
}

export function newGame(): GameState {
  const meta = newMeta();
  return { v: SAVE_VERSION, savedAt: Date.now(), run: newRun(meta), meta };
}

/** Fill in any fields missing from an older save using a fresh default. */
export function migrate(raw: any): GameState {
  const fresh = newGame();
  // Saves from before Ascension existed: all Favor so far counts toward the first Ascension.
  if (raw?.meta && raw.meta.ascFavor === undefined) raw.meta.ascFavor = raw.meta.totalFavor ?? 0;
  const out = fill(raw, fresh) as GameState;
  out.v = SAVE_VERSION;
  sanitize(out);
  return out;
}

/** Replace ids this version doesn't know (hand-edited or future saves) with safe defaults. */
function sanitize(s: GameState) {
  const r = s.run, m = s.meta;
  if (!(r.race in RACES)) r.race = 'dwarf';
  if (!(r.god in GODS)) r.god = 'forge';
  m.races = m.races.filter((x) => x in RACES);
  m.gods = m.gods.filter((x) => x in GODS);
  if (!m.races.includes('dwarf')) m.races.unshift('dwarf');
  if (!m.gods.includes('forge')) m.gods.unshift('forge');
  m.loadout = m.loadout.filter((a) => a in ABILITIES);
  m.curios = Object.fromEntries(Object.entries(m.curios).filter(([id, n]) => id in CURIOS && n > 0));
  r.floors = r.floors.map((f) => (f && f.type in FLOORS && f.level >= 1 ? f : null));
}

function fill(target: any, defaults: any): any {
  if (target === undefined || target === null) return defaults;
  if (Array.isArray(defaults)) return Array.isArray(target) ? target : defaults;
  if (typeof defaults === 'object' && defaults !== null) {
    if (typeof target !== 'object') return defaults;
    for (const k of Object.keys(defaults)) target[k] = fill(target[k], defaults[k]);
    return target;
  }
  return typeof target === typeof defaults ? target : defaults;
}
