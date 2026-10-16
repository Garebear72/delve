// Derived numbers: everything computed from state (rates, caps, squad stats).
import {
  ACH_BONUS, ADJACENCY, BIOMES, CLASSES, CLASS_IDS, ENEMIES, FLOOR_IDS, FloorId, GEAR, GUARDIANS, JobId,
  RELICS, RelicEffect, RES_IDS, ResId, ZONE_CELLS,
} from '../data/defs';
import type { GameState } from './state';

export function biomeIndexAt(level: number): number {
  let idx = 0;
  for (let i = 0; i < BIOMES.length; i++) if (level >= BIOMES[i].from) idx = i;
  return idx;
}
export const biomeAt = (level: number) => BIOMES[biomeIndexAt(level)];

/** Guardian index blocking the next dig, or -1. */
export function blockingGuardian(s: GameState): number {
  for (let i = 1; i < BIOMES.length; i++) {
    if (s.run.depth === BIOMES[i].from && !s.run.guardians.includes(i - 1)) return i - 1;
  }
  return -1;
}

export const levelHp = (level: number) => 8 * Math.pow(1.14, level);
export const div = (s: GameState, id: string) => s.meta.divine[id] ?? 0;

export function relicBonus(s: GameState, effect: RelicEffect): number {
  let b = 0;
  for (const id of s.run.relics) if (RELICS[id]?.effect === effect) b += RELICS[id].value;
  return b;
}

/** Strength of each floor slot (level × biome × adjacency). */
export function floorPower(s: GameState, i: number): number {
  const f = s.run.floors[i];
  if (!f) return 0;
  const biome = biomeAt(i).floorMult[f.type] ?? 1;
  let adj = 1;
  for (const n of [i - 1, i + 1]) {
    const o = s.run.floors[n];
    if (o && ADJACENCY.some(([a, b]) => (a === f.type && b === o.type) || (b === f.type && a === o.type))) adj += 0.25;
  }
  return f.level * biome * adj;
}

export function floorCostMult(s: GameState): number {
  return s.run.research.includes('masonry') ? 0.75 : 1;
}

export interface Derived {
  floors: Record<FloorId, number>;
  globalMult: number;
  maxPop: number;
  idle: number;
  free: number;
  reserved: number;
  caps: Record<ResId, number>;
  rates: Record<ResId, number>;
  jobRate: Record<JobId, number>;
  digPower: number;
  tapPower: number;
  growth: number;
  squadCap: number;
  regroupTime: number;
  gearCostMult: number;
  favorMult: number;
  unionBreak: boolean;
  blocked: number;
}

export function derive(s: GameState): Derived {
  const r = s.run;
  const floors = Object.fromEntries(FLOOR_IDS.map((f) => [f, 0])) as Record<FloorId, number>;
  r.floors.forEach((f, i) => { if (f) floors[f.type] += floorPower(s, i); });

  const globalMult = 1 + s.meta.achievements.length * ACH_BONUS;
  const goblin = r.race === 'goblin';
  const unionBreak = goblin && r.time % 120 >= 100;
  const jobMult = (unionBreak ? 0 : 1) * (goblin ? 1.4 : 1) * globalMult;

  const mineMult = jobMult * (1 + 0.25 * div(s, 'picks')) * (r.research.includes('sharpPicks') ? 1.5 : 1)
    * (r.research.includes('deepPicks') ? 2 : 1) * (r.race === 'dwarf' ? 1.25 : 1);
  const foodMult = jobMult * (1 + floors.farm * 0.5) * (1 + 0.25 * div(s, 'harvest'))
    * (r.research.includes('compost') ? 1.5 : 1) * (r.god === 'snorg' ? 1.5 : 1) * (1 + relicBonus(s, 'food'));
  const knowMult = jobMult * (1 + floors.library * 0.5) * (1 + 0.25 * div(s, 'wisdom'))
    * (r.research.includes('indexCards') ? 1.5 : 1) * (1 + relicBonus(s, 'know'));

  const miners = r.jobs.miner;
  const jobRate: Record<JobId, number> = {
    miner: 0.5 * mineMult * (1 + relicBonus(s, 'dig')),
    farmer: 0.6 * foodMult,
    scholar: 0.25 * knowMult,
  };
  const digPower = miners * jobRate.miner;
  const tapPower = Math.max(1, (r.jobs.miner * 0.5 * mineMult + 1)) * Math.pow(2, div(s, 'finger'));

  const rates = Object.fromEntries(RES_IDS.map((k) => [k, 0])) as Record<ResId, number>;
  rates.food = r.jobs.farmer * jobRate.farmer - r.pop * 0.05;
  rates.stone = miners * 0.6 * mineMult * (r.god === 'pebble' ? 2 : 1);
  if (r.depth >= BIOMES[1].from) rates.copper = miners * 0.12 * mineMult;
  if (r.depth >= BIOMES[3].from) rates.iron = miners * 0.05 * mineMult;
  rates.knowledge = r.jobs.scholar * jobRate.scholar;

  const cap = 100 + floors.storage * 200;
  const caps = Object.fromEntries(RES_IDS.map((k) => [k, Infinity])) as Record<ResId, number>;
  caps.food = cap; caps.stone = cap; caps.copper = cap; caps.iron = cap;

  const bunk = r.research.includes('bunkBeds') ? 7.5 : 5;
  const maxPop = Math.floor(6 + floors.bunk * bunk + 3 * div(s, 'fertile'));
  const jobsTotal = r.jobs.miner + r.jobs.farmer + r.jobs.scholar;
  // Colonists not in a job. Until the squad marches out, its planned members are reserved and not idle.
  const free = Math.max(0, Math.floor(r.pop) - jobsTotal);
  const planTotal = Object.values(r.combat.plan).reduce((a, b) => a + b, 0);
  const reserved = r.combatUnlocked && !r.combat.alive ? Math.min(free, planTotal) : 0;
  const idle = free - reserved;
  const growth = 0.25 * (1 + floors.tavern * 0.5) * (1 + 0.2 * div(s, 'fertile'))
    * (r.god === 'snorg' ? 1.25 : 1) * (1 + relicBonus(s, 'growth')) * globalMult;

  return {
    floors, globalMult, maxPop, idle, free, reserved, caps, rates, jobRate, digPower, tapPower, growth,
    squadCap: 3 + Math.floor(floors.barracks * 3),
    regroupTime: 5 / (1 + floors.barracks * 0.5),
    gearCostMult: 1 / (1 + floors.forge * 0.2),
    favorMult: (1 + floors.shrine * 0.15) * Math.pow(1.25, r.guardians.length),
    unionBreak,
    blocked: blockingGuardian(s),
  };
}

// ---------------------------------------------------------------- combat numbers
export function gearMult(s: GameState, kind: 'w' | 'a'): number {
  const g = s.run.gear;
  const tier = kind === 'w' ? g.wTier : g.aTier;
  const lvl = kind === 'w' ? g.wLvl : g.aLvl;
  const base = GEAR.tierBase[tier] * (1 + 0.25 * lvl);
  return s.run.god === 'forge' ? base * 1.25 : base;
}

export function squadStats(s: GameState, comp = s.run.combat.squad) {
  const c = s.run.combat;
  let hp = 0, dps = 0, heal = 0, block = 0, n = 0;
  for (const id of CLASS_IDS) {
    const k = comp[id]; if (!k) continue;
    const def = CLASSES[id];
    hp += k * def.hp; dps += (k * def.atk) / def.speed; heal += k * def.heal; block += k * def.block; n += k;
  }
  const am = gearMult(s, 'a'), wm = gearMult(s, 'w');
  const hpMult = am * (1 + 0.2 * div(s, 'stoneskin')) * (s.run.race === 'dwarf' ? 1.1 : 1) * (1 + relicBonus(s, 'hp'));
  const atkMult = wm * (1 + 0.2 * div(s, 'fervor')) * (1 + relicBonus(s, 'atk')) * (c.cry > 0 ? 2 : 1);
  const maxHp = hp * hpMult;
  return {
    size: n,
    maxHp,
    atk: dps * atkMult, // average damage per second, for display
    atkMult, // multiplies each individual hit
    heal: heal * am + maxHp * 0.01, // HP per second, delivered in pulses
    block: n ? Math.min(0.75, block / n) : 0,
  };
}

function hash(a: number, b: number) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function enemyFor(zone: number, cell: number): string {
  if (cell === ZONE_CELLS - 1) return 'troll';
  const pool = Object.keys(ENEMIES).filter((k) => ENEMIES[k].from <= zone);
  return pool[Math.floor(hash(zone, cell) * pool.length)];
}

export function enemyStats(s: GameState) {
  const c = s.run.combat;
  if (c.mode === 'guardian') {
    const g = GUARDIANS[c.guardian];
    return { name: g.name, sprite: g.sprite, pal: g.pal, scale: g.scale, hp: g.hp, atk: g.atk, speed: 1.8, boss: true, guardian: true };
  }
  const boss = c.cell === ZONE_CELLS - 1;
  const z = c.zone - 1;
  const grow = 1 + 0.03 * c.cell;
  const e = ENEMIES[c.enemyId] ?? ENEMIES.rat;
  return {
    name: boss ? `${e.name} (Zone Boss)` : e.name,
    sprite: e.sprite, pal: e.pal, scale: boss ? 5 : 3,
    hp: 18 * Math.pow(1.33, z) * grow * (boss ? 6 : 1),
    atk: 1.5 * Math.pow(1.3, z) * grow * (boss ? 2 : 1), // damage per second; each hit = atk × speed
    speed: boss ? 1.4 : 1,
    boss, guardian: false,
  };
}

export function goldMult(s: GameState) {
  return (1 + 0.25 * div(s, 'greed')) * (s.run.research.includes('haggling') ? 1.5 : 1) * (1 + relicBonus(s, 'gold'));
}

// ---------------------------------------------------------------- prestige
export function pendingFavor(s: GameState, d: Derived): number {
  const r = s.run;
  const raw = Math.pow(r.depth, 1.4) / 8 + Math.pow(r.maxZone, 1.7) / 3;
  return Math.floor(raw * d.favorMult);
}
export const canPrestige = (s: GameState, d: Derived) => s.run.depth >= 8 && pendingFavor(s, d) >= 1;
