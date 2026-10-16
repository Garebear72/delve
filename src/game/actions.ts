// Player actions. Each returns true when something changed.
import { CLASSES, ClassId, DIVINE, FLOORS, FloorId, GEAR, GodId, JobId, JOBS, RaceId, RESEARCH, ResId, RELICS } from '../data/defs';
import { derive, div, floorCostMult, pendingFavor, canPrestige } from './calc';
import { emit, toast } from './events';
import { digCheck, add } from './sim';
import { GameState, newRun } from './state';

type Cost = Partial<Record<ResId, number>>;

export function canAfford(s: GameState, cost: Cost) {
  return Object.entries(cost).every(([k, v]) => s.run.res[k as ResId] >= (v ?? 0));
}
function pay(s: GameState, cost: Cost) {
  for (const [k, v] of Object.entries(cost)) s.run.res[k as ResId] -= v ?? 0;
}
const scale = (cost: Cost, m: number): Cost =>
  Object.fromEntries(Object.entries(cost).map(([k, v]) => [k, Math.ceil((v ?? 0) * m)]));

// ---------------------------------------------------------------- mine
export function tapDig(s: GameState) {
  const d = derive(s);
  add(s, 'taps', 1);
  if (d.blocked >= 0) { emit('tapBlocked'); return false; }
  s.run.dig += d.tapPower;
  const stone = Math.min(d.caps.stone - s.run.res.stone, 1 + d.tapPower * 0.2);
  if (stone > 0) { s.run.res.stone += stone; add(s, 'res.stone', stone); }
  emit('tap', d.tapPower);
  digCheck(s);
  return true;
}

export function floorBuildCost(s: GameState, type: FloorId): Cost {
  const built = s.run.floors.filter((f) => f?.type === type).length;
  return scale(FLOORS[type].cost, Math.pow(1.35, built) * floorCostMult(s));
}
export function floorUpgradeCost(s: GameState, slot: number): Cost {
  const f = s.run.floors[slot]!;
  return scale(FLOORS[f.type].cost, 2.2 * Math.pow(2.2, f.level - 1) * floorCostMult(s));
}

export function buildFloor(s: GameState, slot: number, type: FloorId) {
  if (slot >= s.run.depth || s.run.floors[slot] || !FLOORS[type].unlock(s)) return false;
  const cost = floorBuildCost(s, type);
  if (!canAfford(s, cost)) return false;
  pay(s, cost);
  s.run.floors[slot] = { type, level: 1 };
  if (type === 'barracks' && !s.run.combatUnlocked) {
    s.run.combatUnlocked = true;
    toast('Monsters spotted in the side caverns! The Expedition (Battle tab) is open.', 'epic');
  }
  emit('built', slot);
  return true;
}
export function upgradeFloor(s: GameState, slot: number) {
  const f = s.run.floors[slot];
  if (!f) return false;
  const cost = floorUpgradeCost(s, slot);
  if (!canAfford(s, cost)) return false;
  pay(s, cost);
  f.level++;
  emit('built', slot);
  return true;
}
export function demolishFloor(s: GameState, slot: number) {
  if (!s.run.floors[slot]) return false;
  s.run.floors[slot] = null;
  return true;
}

// ---------------------------------------------------------------- colony
export function assignJob(s: GameState, job: JobId, n: number) {
  if (!JOBS[job].unlock(s)) return false;
  const d = derive(s);
  const amt = n > 0 ? Math.min(n, d.idle) : Math.max(n, -s.run.jobs[job]);
  if (!amt) return false;
  s.run.jobs[job] += amt;
  return true;
}

export function buyResearch(s: GameState, id: string) {
  const r = RESEARCH.find((x) => x.id === id);
  if (!r || s.run.research.includes(id) || !r.req(s) || !canAfford(s, r.cost)) return false;
  pay(s, r.cost);
  s.run.research.push(id);
  toast(`Researched: ${r.name}`, 'good');
  return true;
}

// ---------------------------------------------------------------- combat
export function setPlan(s: GameState, cls: ClassId, delta: number) {
  const c = s.run.combat;
  if (!CLASSES[cls].unlock(s)) return false;
  const d = derive(s);
  const total = Object.values(c.plan).reduce((a, b) => a + b, 0);
  // Adding a soldier takes an idle colonist (they're reserved until the squad marches out).
  const add = delta > 0 ? Math.min(delta, d.squadCap - total, c.alive ? Infinity : d.idle) : Math.max(delta, -c.plan[cls]);
  if (!add) return false;
  c.plan[cls] += add;
  return true;
}

export function gearLevelCost(s: GameState, kind: 'w' | 'a') {
  const g = s.run.gear;
  const tier = kind === 'w' ? g.wTier : g.aTier;
  const lvl = kind === 'w' ? g.wLvl : g.aLvl;
  const metal = GEAR.metal[tier];
  return { [metal]: Math.ceil(8 * Math.pow(1.22, lvl) * GEAR.tierCost[tier] * derive(s).gearCostMult) } as Cost;
}
export function gearTierCost(s: GameState, kind: 'w' | 'a') {
  const tier = (kind === 'w' ? s.run.gear.wTier : s.run.gear.aTier) + 1;
  if (tier >= GEAR.metal.length) return null;
  const m = derive(s).gearCostMult;
  return { gold: Math.ceil(40 * Math.pow(8, tier - 1) * m), [GEAR.metal[tier]]: Math.ceil(60 * Math.pow(4, tier - 1) * m) } as Cost;
}
export function gearTierReady(s: GameState, kind: 'w' | 'a') {
  const tier = (kind === 'w' ? s.run.gear.wTier : s.run.gear.aTier) + 1;
  if (tier >= GEAR.metal.length) return false;
  return s.run.research.includes(GEAR.tierResearch[tier]) && s.run.floors.some((f) => f?.type === 'forge');
}
export function buyGearLevel(s: GameState, kind: 'w' | 'a') {
  const cost = gearLevelCost(s, kind);
  if (!canAfford(s, cost)) return false;
  pay(s, cost);
  if (kind === 'w') s.run.gear.wLvl++; else s.run.gear.aLvl++;
  return true;
}
export function buyGearTier(s: GameState, kind: 'w' | 'a') {
  const cost = gearTierCost(s, kind);
  if (!cost || !gearTierReady(s, kind) || !canAfford(s, cost)) return false;
  pay(s, cost);
  const g = s.run.gear;
  if (kind === 'w') { g.wTier++; g.wLvl = 0; } else { g.aTier++; g.aLvl = 0; }
  toast(`Forged: ${kind === 'w' ? GEAR.weapon[g.wTier] : GEAR.armor[g.aTier]}!`, 'good');
  return true;
}

// ---------------------------------------------------------------- divine
export function divineCost(s: GameState, id: string) {
  const def = DIVINE.find((x) => x.id === id)!;
  return Math.ceil(def.base * Math.pow(def.growth, div(s, id)));
}
export function buyDivine(s: GameState, id: string) {
  const def = DIVINE.find((x) => x.id === id);
  if (!def || (def.max !== undefined && div(s, id) >= def.max)) return false;
  const cost = divineCost(s, id);
  if (s.meta.favor < cost) return false;
  s.meta.favor -= cost;
  s.meta.divine[id] = div(s, id) + 1;
  return true;
}
export const reliquarySlots = (s: GameState) => 1 + div(s, 'reliquary');

export function prestige(s: GameState, keep: string[], race: RaceId, god: GodId) {
  const d = derive(s);
  if (!canPrestige(s, d)) return false;
  const gain = pendingFavor(s, d);
  const kept = keep.filter((id) => s.run.relics.includes(id)).slice(0, reliquarySlots(s));
  // Relics you don't keep turn into a little bonus favor.
  const bonus = s.run.relics.filter((id) => !kept.includes(id)).reduce((a, id) => a + (RELICS[id].rare ? 5 : 2), 0);
  s.meta.favor += gain + bonus;
  s.meta.totalFavor += gain + bonus;
  s.meta.prestiges++;
  s.meta.reliquary = kept;
  if (s.meta.prestiges === 1) {
    if (!s.meta.races.includes('goblin')) s.meta.races.push('goblin');
    if (!s.meta.gods.includes('snorg')) s.meta.gods.push('snorg');
  }
  s.run = newRun(s.meta, s.meta.races.includes(race) ? race : 'dwarf', s.meta.gods.includes(god) ? god : 'forge');
  toast(`A new expedition begins! +${gain + bonus} Divine Favor.`, 'epic');
  emit('prestige');
  return true;
}
