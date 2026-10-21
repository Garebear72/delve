// Derived numbers: everything computed from state (rates, caps, squad stats).
import { CURIOS, CURIO_MAX, CurioEffect } from '../data/minigames';
import {
  AbilityId, ACH_BONUS, ADJACENCY, BIOMES, CLASSES, CLASS_IDS, ENEMIES, FLOOR_IDS, FloorId, ENEMY_ATK, ENEMY_ATK_GROWTH, ENEMY_HP, ENEMY_HP_GROWTH, FOOD_PER_COLONIST, GEAR, GROWTH_BASE, GROWTH_PER_POP, GUARDIANS, JobId,
  CRIT_CHANCE, DEEP_FROM, DIVINE, ENEMY_ATK_LATE, ENEMY_HP_LATE, FAVOR_DEEP, FAVOR_ZONE, LATE_ZONE, LEVEL_HP, LEVEL_HP_DEEP, LEVEL_HP_GROWTH, RESOURCES, KILL_HEAL, ORES, RELICS, RelicEffect, RESEARCH, ResearchStat, RES_IDS, ResId, ZONE_CELLS,
} from '../data/defs';
import { leftAlone } from './input';
import { bonuses, equipped } from './skills';
import type { GameState } from './state';

const BIOME_OF: number[] = []; // biome index per level, filled in lazily (floorPower asks for it a lot)
export function biomeIndexAt(level: number): number {
  if (level >= 0 && BIOME_OF[level] !== undefined) return BIOME_OF[level];
  let idx = 0;
  for (let i = 0; i < BIOMES.length; i++) if (level >= BIOMES[i].from) idx = i;
  if (level >= 0 && level < 100000) BIOME_OF[level] = idx;
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

/** Toughness of each mine level: steep through the first five biomes, gentler past the Magma Rift. */
export const levelHp = (level: number) =>
  LEVEL_HP * Math.pow(LEVEL_HP_GROWTH, Math.min(level, DEEP_FROM)) * Math.pow(LEVEL_HP_DEEP, Math.max(0, level - DEEP_FROM));
export const div = (s: GameState, id: string) => s.meta.divine[id] ?? 0;
/** Wheel of the Gods blessings taken this run. */
export const boonOf = (s: GameState, id: string) => s.run.boons[id] ?? 0;
const DIVINE_MULT = Object.fromEntries(DIVINE.map((x) => [x.id, x.mult ?? 0]));
/** Compounding Divine Tree multiplier: (1 + mult)^level. */
export const divMult = (s: GameState, id: string) => Math.pow(1 + (DIVINE_MULT[id] ?? 0), div(s, id));

/** Product of every completed research's multiplier for this stat. */
export function researchMult(s: GameState, stat: ResearchStat): number {
  let m = 1;
  for (const id of s.run.research) {
    const v = RESEARCH_BY_ID[id]?.effects?.[stat];
    if (v) m *= 1 + v;
  }
  return m;
}
const RESEARCH_BY_ID = Object.fromEntries(RESEARCH.map((x) => [x.id, x]));
const researchSum = (s: GameState, key: 'squadCap' | 'bunk') => s.run.research.reduce((a, id) => a + (RESEARCH_BY_ID[id]?.[key] ?? 0), 0);

// Abilities are learned in the skill trees and must be equipped in the loadout to be used.
export const hasAbility = (s: GameState, id: AbilityId) => equipped(s, id);
export const hasAutoCast = (s: GameState) => bonuses(s).autoCast > 0;
const pct = (v: number) => Math.max(0.1, 1 + v); // skill bonus as a multiplier, never below 10%

/** Relics held this run plus permanent Curios with the same effect. */
export function relicBonus(s: GameState, effect: RelicEffect): number {
  let b = curioBonus(s, effect);
  for (const id of s.run.relics) if (RELICS[id]?.effect === effect) b += RELICS[id].value;
  return b;
}

/** Bonus from Curios: each copy (up to CURIO_MAX) adds the Curio's value again. */
export function curioBonus(s: GameState, effect: CurioEffect): number {
  let b = 0;
  for (const [id, n] of Object.entries(s.meta.curios)) {
    const c = CURIOS[id];
    if (c?.effect === effect) b += c.value * Math.min(n, CURIO_MAX);
  }
  return b;
}

/** Neighbouring pairs that boost each other, both ways round, for quick lookups. */
const ADJ: Partial<Record<FloorId, Set<FloorId>>> = {};
for (const [a, b] of ADJACENCY) { (ADJ[a] ??= new Set()).add(b); (ADJ[b] ??= new Set()).add(a); }

/** Combined strength of every floor of one type. */
export function floorTotal(s: GameState, type: FloorId): number {
  let n = 0;
  s.run.floors.forEach((f, i) => { if (f?.type === type) n += floorPower(s, i); });
  return n;
}

/** Strength of each floor slot (level × biome × adjacency). */
export function floorPower(s: GameState, i: number): number {
  const f = s.run.floors[i];
  if (!f) return 0;
  const biome = biomeAt(i).floorMult[f.type] ?? 1;
  let adj = 1;
  const up = s.run.floors[i - 1], down = s.run.floors[i + 1];
  const friends = ADJ[f.type];
  if (up && friends?.has(up.type)) adj += 0.25;
  if (down && friends?.has(down.type)) adj += 0.25;
  return f.level * biome * adj;
}

export function floorCostMult(s: GameState): number {
  return (s.run.research.includes('masonry') ? 0.75 : 1) * Math.max(0.2, 1 - bonuses(s).floorCost);
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
  hungry: boolean;
  blocked: number;
}

export function derive(s: GameState): Derived {
  const r = s.run;
  const b = bonuses(s);
  const floors = Object.fromEntries(FLOOR_IDS.map((f) => [f, 0])) as Record<FloorId, number>;
  r.floors.forEach((f, i) => { if (f) floors[f.type] += floorPower(s, i); });

  const globalMult = (1 + s.meta.achievements.length * ACH_BONUS) * (1 + curioBonus(s, 'all'));
  const goblin = r.race === 'goblin';
  const unionBreak = goblin && r.time % 120 >= 100;
  const alone = leftAlone();
  const jobMult = (unionBreak ? 0 : 1) * (goblin ? 1.4 : 1) * globalMult * pct(b.jobs)
    * (b.idleJobs && alone ? 1 + b.idleJobs : 1) * (r.god === 'moss' && alone ? 1.25 : 1);

  const foodMult = jobMult * (1 + floors.farm * 0.5) * divMult(s, 'harvest') * Math.pow(3, boonOf(s, 'food')) * pct(b.food) * researchMult(s, 'food')
    * (r.research.includes('compost') ? 1.5 : 1) * (r.god === 'snorg' ? 1.5 : 1) * (1 + relicBonus(s, 'food'));
  const farmed = r.jobs.farmer * 0.5 * foodMult;
  const eaten = r.pop * FOOD_PER_COLONIST * Math.max(0.2, 1 - b.eat);
  // Out of mushrooms and not growing enough: miners and scholars work at half speed.
  const hungry = r.res.food <= 0.01 && farmed < eaten;
  const hunger = hungry ? 0.5 : 1;

  const mineMult = jobMult * hunger * divMult(s, 'picks') * Math.pow(2, boonOf(s, 'dig')) * (r.research.includes('sharpPicks') ? 1.5 : 1)
    * (r.research.includes('deepPicks') ? 2 : 1) * (r.race === 'dwarf' ? 1.25 : r.race === 'kobold' ? 0.9 : 1)
    * (r.god === 'krog' ? 0.85 : 1) * pct(b.dig);
  const knowMult = jobMult * hunger * (1 + floors.library * 0.5) * divMult(s, 'wisdom') * pct(b.know) * researchMult(s, 'know')
    * (r.research.includes('indexCards') ? 1.5 : 1) * (1 + relicBonus(s, 'know')) * (r.race === 'gnome' ? 1.6 : 1);

  const miners = r.jobs.miner;
  const jobRate: Record<JobId, number> = {
    miner: 0.4 * mineMult * (1 + relicBonus(s, 'dig')) * researchMult(s, 'dig'),
    farmer: 0.5 * foodMult,
    scholar: 0.25 * knowMult,
  };
  const digPower = miners * jobRate.miner;
  // Taps give a flat amount plus a small share of your miners' power.
  const tapPower = (1 + digPower * 0.1) * Math.pow(2, div(s, 'finger')) * pct(b.tap);

  const rates = Object.fromEntries(RES_IDS.map((k) => [k, 0])) as Record<ResId, number>;
  rates.food = farmed - eaten;
  const veins = divMult(s, 'veins');
  rates.stone = miners * 0.6 * mineMult * veins * researchMult(s, 'stone') * (r.god === 'pebble' ? 2 : 1) * pct(b.stone);
  const oreMult = mineMult * veins * pct(b.ore) * researchMult(s, 'ore') * (1 + floors.smeltery * 0.4);
  for (const o of ORES) if (r.depth >= BIOMES[o.biome].from) rates[o.res] = miners * o.rate * oreMult;
  rates.knowledge = r.floors.some((f) => f?.type === 'library') ? r.jobs.scholar * jobRate.scholar : 0;

  const cap = (100 + floors.storage * 200) * pct(b.storage) * (r.race === 'kobold' ? 2 : 1);
  const caps = Object.fromEntries(RES_IDS.map((k) => [k, Infinity])) as Record<ResId, number>;
  for (const k of RES_IDS) if (RESOURCES[k].capped) caps[k] = cap;

  const bunk = (r.research.includes('bunkBeds') ? 6 : 4) + researchSum(s, 'bunk');
  const maxPop = Math.floor(6 + floors.bunk * bunk + 3 * div(s, 'fertile') + b.pop);
  const jobsTotal = r.jobs.miner + r.jobs.farmer + r.jobs.scholar;
  // Colonists not in a job. Until the squad marches out, its planned members are reserved and not idle.
  const free = Math.max(0, Math.floor(r.pop) - jobsTotal);
  const planTotal = Object.values(r.combat.plan).reduce((a, b) => a + b, 0);
  const reserved = r.combatUnlocked && !r.combat.alive ? Math.min(free, planTotal) : 0;
  const idle = free - reserved;
  // New dwarves per second: slow for a tiny colony, faster as it grows (Trimps-style breeding).
  const growth = (GROWTH_BASE + r.pop * GROWTH_PER_POP) * (1 + floors.tavern * 0.5) * divMult(s, 'fertile')
    * (r.god === 'snorg' ? 1.25 : 1) * (1 + relicBonus(s, 'growth')) * globalMult * pct(b.growth);

  return {
    floors, globalMult, maxPop, idle, free, reserved, caps, rates, jobRate, digPower, tapPower, growth,
    squadCap: 3 + Math.floor(floors.barracks * 3) + b.squadCap + researchSum(s, 'squadCap') + div(s, 'tactics'),
    regroupTime: 5 / (1 + floors.barracks * 0.5) / pct(b.regroup) / researchMult(s, 'regroup'),
    gearCostMult: Math.max(0.2, 1 - b.gearCost) / (1 + floors.forge * 0.2),
    favorMult: (1 + floors.shrine * 0.15) * Math.pow(1.25, r.guardians.length) * (1 + b.favor) * researchMult(s, 'favor')
      * (1 + curioBonus(s, 'favor')) * (1 + 0.25 * boonOf(s, 'favor')),
    unionBreak,
    hungry,
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
  const b = bonuses(s);
  const am = gearMult(s, 'a'), wm = gearMult(s, 'w');
  const arena = 1 + floorTotal(s, 'arena') * 0.15;
  const race = s.run.race;
  const hpMult = am * divMult(s, 'stoneskin') * (race === 'dwarf' ? 1.1 : race === 'gnome' ? 0.8 : 1) * (1 + relicBonus(s, 'hp'))
    * pct(b.hp) * researchMult(s, 'hp') * arena;
  const atkMult = wm * divMult(s, 'fervor') * (1 + relicBonus(s, 'atk')) * (c.cry > 0 ? 2 : 1) * pct(b.dmg)
    * researchMult(s, 'dmg') * arena * (s.run.god === 'krog' ? 1.4 : 1) * Math.pow(2, boonOf(s, 'dmg'));
  const maxHp = hp * hpMult;
  const speed = pct(b.speed);
  const critChance = Math.min(1, CRIT_CHANCE + b.crit);
  const critMult = 2 + b.critDmg;
  return {
    size: n,
    maxHp,
    atk: dps * atkMult * speed * (1 + critChance * (critMult - 1)), // average damage per second, for display
    atkMult, // multiplies each individual hit
    speed, // divides every class's time between swings
    critChance,
    critMult,
    killHeal: KILL_HEAL + b.killHeal,
    bossMult: (1 + b.bossDmg) * divMult(s, 'giantbane'), // extra damage against zone bosses and guardians
    heal: heal * am + maxHp * b.regen, // HP per second, delivered in pulses (regen only comes from skills)
    block: n ? Math.min(0.75, block / n + b.block) : 0,
  };
}

/** Enemy scaling: `early` per zone up to LATE_ZONE, then the gentler `late` rate. */
/** A regular (non-boss) Expedition monster's HP and attack at a zone. */
export const zoneMonster = (zone: number) => ({
  hp: ENEMY_HP * zoneGrowth(zone - 1, ENEMY_HP_GROWTH, ENEMY_HP_LATE),
  atk: ENEMY_ATK * zoneGrowth(zone - 1, ENEMY_ATK_GROWTH, ENEMY_ATK_LATE),
});
const zoneGrowth = (z: number, early: number, late: number) => Math.pow(early, Math.min(z, LATE_ZONE)) * Math.pow(late, Math.max(0, z - LATE_ZONE));

function hash(a: number, b: number) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const BOSSES = Object.keys(ENEMIES).filter((k) => ENEMIES[k].boss).sort((a, b) => ENEMIES[a].from - ENEMIES[b].from);
const REGULARS = Object.keys(ENEMIES).filter((k) => !ENEMIES[k].boss).sort((a, b) => ENEMIES[a].from - ENEMIES[b].from);
/** The zone boss is the newest boss type unlocked; regular cells pick from the 6 newest monster types. */
export function enemyFor(zone: number, cell: number): string {
  if (cell === ZONE_CELLS - 1) return BOSSES.filter((k) => ENEMIES[k].from <= zone).pop() ?? 'troll';
  const pool = REGULARS.filter((k) => ENEMIES[k].from <= zone).slice(-6);
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
  const grow = 1 + 0.04 * c.cell;
  const e = ENEMIES[c.enemyId] ?? ENEMIES.rat;
  return {
    name: boss ? `${e.name} (Zone Boss)` : e.name,
    sprite: e.sprite, pal: e.pal, scale: boss ? 5 : 3,
    hp: ENEMY_HP * zoneGrowth(z, ENEMY_HP_GROWTH, ENEMY_HP_LATE) * grow * (boss ? 6 : 1),
    atk: ENEMY_ATK * zoneGrowth(z, ENEMY_ATK_GROWTH, ENEMY_ATK_LATE) * grow * (boss ? 2 : 1), // damage per second; each hit = atk × speed
    speed: boss ? 1.4 : 1,
    boss, guardian: false,
  };
}

export function goldMult(s: GameState) {
  return divMult(s, 'greed') * (s.run.research.includes('haggling') ? 1.5 : 1) * (1 + relicBonus(s, 'gold')) * pct(bonuses(s).gold)
    * researchMult(s, 'gold') * (1 + floorTotal(s, 'treasury') * 0.25) * (s.run.race === 'kobold' ? 1.3 : 1) * Math.pow(2, boonOf(s, 'gold'));
}

// ---------------------------------------------------------------- prestige
export function pendingFavor(s: GameState, d: Derived): number {
  const r = s.run;
  // Polynomial early on, then exponential past depth 35 / zone 20 so going deeper always pays more.
  const raw = (Math.pow(r.depth, 1.4) / 8 + Math.pow(r.maxZone, 1.7) / 3)
    * Math.pow(FAVOR_DEEP, Math.max(0, r.depth - 35)) * Math.pow(FAVOR_ZONE, Math.max(0, r.maxZone - 20));
  return Math.floor(raw * d.favorMult);
}
/** You can only prestige once this run's first guardian (The Very Large Worm) has been defeated. */
export const canPrestige = (s: GameState, d: Derived) => s.run.guardians.includes(0) && pendingFavor(s, d) >= 1;
