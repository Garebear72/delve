// Player actions. Each returns true when something changed.
import { MINIGAMES } from '../data/minigames';
import { gameForPrestige } from './minigames';
import { CELESTIAL, CLASSES, ClassId, COMBO_MAX, COMBO_STEP, COMBO_WINDOW, DIVINE, FLOORS, FloorId, GEAR, GodId, JobId, JOBS, RaceId, RESEARCH, ResId, RELICS } from '../data/defs';
import { canAscend, canPrestige, cel, derive, div, floorCostMult, pendingFavor, pendingSparks } from './calc';
import { emit, toast } from './events';
import { digCheck, add, fitSquadPlan } from './sim';
import { addXp, bonuses, respecTrees } from './skills';
import { TAP_CRIT_MULT, XP } from '../data/skills';
import { markInput } from './input';
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
// Tap combo: keep tapping without a long pause for up to +50% tap power.
let combo = 0;
let lastTapAt = 0;
let xpWindowStart = 0;
let xpTaps = 0;
export function tapDig(s: GameState) {
  const d = derive(s);
  const b = bonuses(s);
  add(s, 'taps', 1);
  const now = performance.now();
  combo = now - lastTapAt < COMBO_WINDOW + b.comboWindow ? combo + 1 : 1;
  lastTapAt = now;
  if (combo > (s.meta.lifetime.bestCombo ?? 0)) s.meta.lifetime.bestCombo = combo;
  // Hands-On XP counts at most XP.tapXpPerSec taps per second, however many fingers are drumming.
  if (now - xpWindowStart > 1000) { xpWindowStart = now; xpTaps = 0; }
  if (++xpTaps <= XP.tapXpPerSec) addXp(s, 'handsOn', XP.tap * (1 + Math.min(combo, 50) / 50));
  markInput();
  const crit = Math.random() < b.tapCrit;
  const power = d.tapPower * (1 + Math.min(COMBO_MAX + b.combo, combo * COMBO_STEP)) * (crit ? TAP_CRIT_MULT + b.tapCritDmg : 1);
  // Every tap knocks loose some stone, even against a guardian's seal.
  const stone = Math.min(d.caps.stone - s.run.res.stone, (1 + power * 0.2) * (1 + b.tapStone));
  if (stone > 0) { s.run.res.stone += stone; add(s, 'res.stone', stone); }
  if (d.blocked >= 0) { emit('tapBlocked', { stone }); return false; }
  s.run.dig += power;
  emit('tap', { power, combo, crit });
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

/** Floor unlocks stick for the rest of the run once announced, even if the condition later drops (e.g. population). */
export const floorUnlocked = (s: GameState, type: FloorId) =>
  FLOORS[type].unlock(s) || s.run.seen.includes('floor.' + type);

export function buildFloor(s: GameState, slot: number, type: FloorId) {
  if (slot >= s.run.depth || s.run.floors[slot] || !floorUnlocked(s, type)) return false;
  const cost = floorBuildCost(s, type);
  if (!canAfford(s, cost)) return false;
  pay(s, cost);
  s.run.floors[slot] = { type, level: 1 };
  addXp(s, 'colony', XP.build);
  if (type === 'barracks' && !s.run.combatUnlocked) {
    s.run.combatUnlocked = true;
    fitSquadPlan(s, derive(s).squadCap); // the starting squad only takes colonists who are free
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
  addXp(s, 'colony', XP.build);
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
  // Workers can always be taken out of a job, even one that's locked again (e.g. Library demolished).
  if (n > 0 && !JOBS[job].unlock(s)) return false;
  const d = derive(s);
  const amt = n > 0 ? Math.min(n, d.idle) : Math.max(n, -s.run.jobs[job]);
  if (!amt) return false;
  s.run.jobs[job] += amt;
  return true;
}

/** Research cost after skill discounts. */
export const researchCost = (s: GameState, r: { cost: Cost }) =>
  scale(r.cost, Math.max(0.3, 1 - bonuses(s).researchCost) * (s.run.race === 'gnome' ? 0.7 : 1));

export function buyResearch(s: GameState, id: string) {
  const r = RESEARCH.find((x) => x.id === id);
  if (!r || s.run.research.includes(id) || !r.req(s)) return false;
  const cost = researchCost(s, r);
  if (!canAfford(s, cost)) return false;
  pay(s, cost);
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
  // Soldiers are a job: adding one takes an idle colonist, who stays a soldier until you remove them.
  // (Clamped at 0: if the cap dropped below the plan, e.g. a Barracks was demolished, "+" must not subtract.)
  const add = delta > 0 ? Math.max(0, Math.min(delta, d.squadCap - total, d.idle)) : Math.max(delta, -c.plan[cls]);
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
  return Math.ceil(def.base * Math.pow(def.growth, div(s, id)) * Math.pow(0.92, cel(s, 'bargain')));
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

export function prestige(s: GameState, keep: string[], race: RaceId, god: GodId, respec = false) {
  const d = derive(s);
  if (!canPrestige(s, d)) return false;
  const gain = pendingFavor(s, d);
  const kept = keep.filter((id) => s.run.relics.includes(id)).slice(0, reliquarySlots(s));
  // Relics you don't keep turn into a little bonus favor.
  const bonus = s.run.relics.filter((id) => !kept.includes(id)).reduce((a, id) => a + (RELICS[id].rare ? 5 : 2), 0);
  s.meta.favor += gain + bonus;
  s.meta.totalFavor += gain + bonus;
  s.meta.ascFavor += gain + bonus;
  s.meta.prestiges++;
  s.meta.reliquary = kept;
  if (respec) respecTrees(s);
  s.run = newRun(s.meta, s.meta.races.includes(race) ? race : 'dwarf', s.meta.gods.includes(god) ? god : 'forge');
  toast(`A new expedition begins! +${gain + bonus} Divine Favor.`, 'epic');
  const game = gameForPrestige(s.meta.prestiges);
  if (game && MINIGAMES[game].built) {
    toast(`New mini-game unlocked: ${MINIGAMES[game].icon} ${MINIGAMES[game].name}! Find it in the Games tab.${game === 'dice' ? ' (It needs a Tavern.)' : ''}`, 'epic');
  }
  emit('prestige');
  return true;
}

// ---------------------------------------------------------------- ascension
export function celestialCost(s: GameState, id: string) {
  const def = CELESTIAL.find((x) => x.id === id)!;
  return Math.ceil(def.base * Math.pow(def.growth, cel(s, id)));
}
export function buyCelestial(s: GameState, id: string) {
  const def = CELESTIAL.find((x) => x.id === id);
  if (!def || (def.max !== undefined && cel(s, id) >= def.max)) return false;
  const cost = celestialCost(s, id);
  if (s.meta.sparks < cost) return false;
  s.meta.sparks -= cost;
  s.meta.celestial[id] = cel(s, id) + 1;
  return true;
}
/** Switch an owned automation upgrade on or off. */
export function toggleCelestial(s: GameState, id: string) {
  if (!CELESTIAL.find((x) => x.id === id)?.toggle || cel(s, id) < 1) return false;
  const off = s.meta.celOff;
  s.meta.celOff = off.includes(id) ? off.filter((x) => x !== id) : [...off, id];
  return true;
}

/** Tier-2 prestige: trade Divine Favor and the Divine Tree (and this run) for Godsparks. */
export function ascend(s: GameState) {
  const d = derive(s);
  if (!canAscend(s, d)) return false;
  const gain = pendingSparks(s, d);
  const m = s.meta;
  m.sparks += gain;
  m.totalSparks += gain;
  m.ascensions++;
  m.favor = 0;
  m.ascFavor = 0;
  m.divine = {};
  m.reliquary = m.reliquary.slice(0, reliquarySlots(s));
  s.run = newRun(m, s.run.race, s.run.god);
  toast(`✨ You Ascend! +${gain} Godsparks. Your Favor and Divine Tree are gone, but the heavens remember you.`, 'epic');
  emit('prestige');
  return true;
}
