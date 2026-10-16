import type { AbilityId, ClassId, FloorId, GodId, JobId, RaceId, ResId } from '../data/defs';
import type { SkillId } from '../data/skills';

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
    farm: false, cry: 0, cryCd: 0, wall: 0, wallCd: 0, autoCast: false, swing: zeroClasses(), eSwing: 0, healT: 0,
  };
}

export function newRun(meta: MetaState, race: RaceId = 'dwarf', god: GodId = 'forge'): RunState {
  const hs = meta.divine.headstart ?? 0;
  return {
    race, god,
    res: { food: 20 + hs * 50, stone: hs * 100, copper: 0, iron: 0, gold: 0, knowledge: 0 },
    pop: 2,
    starve: 0,
    jobs: { miner: 0, farmer: 0, scholar: 0 },
    depth: 0, dig: 0, floors: [],
    gear: { wTier: 0, wLvl: 0, aTier: 0, aLvl: 0 },
    research: [],
    combatUnlocked: false,
    combat: newCombat(),
    maxZone: 0,
    guardians: [],
    relics: [...meta.reliquary],
    items: {},
    time: 0,
    inBreak: false,
    seen: [],
    perks: {},
    perkPoints: 0,
    perkRespecs: 0,
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
  };
}

export function newGame(): GameState {
  const meta = newMeta();
  return { v: SAVE_VERSION, savedAt: Date.now(), run: newRun(meta), meta };
}

/** Fill in any fields missing from an older save using a fresh default. */
export function migrate(raw: any): GameState {
  const fresh = newGame();
  const out = fill(raw, fresh) as GameState;
  out.v = SAVE_VERSION;
  return out;
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
