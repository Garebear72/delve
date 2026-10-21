// Skill levels (RuneScape curve), skill points, tree learning rules, run perks and stat bonuses.
import { ABILITIES, AbilityId } from '../data/defs';
import {
  MAX_LEVEL, NODES, NODE_BY_ID, PERKS, PERK_RESPEC_BASE, SKILLS, SKILL_IDS, SkillId, Stat, STATS, TIER_REQ, TREE_MAX, XP,
} from '../data/skills';
import { toast } from './events';
import { CURIOS, CURIO_MAX } from '../data/minigames';
import type { GameState } from './state';

// ---------------------------------------------------------------- XP curve
// XP_TABLE[L] = total XP needed to reach level L (RuneScape: 99 ≈ 13M).
const XP_TABLE: number[] = [0, 0];
{
  let pts = 0;
  for (let L = 1; L < MAX_LEVEL; L++) {
    pts += Math.floor(L + 300 * Math.pow(2, L / 7));
    XP_TABLE[L + 1] = Math.floor(pts / 4);
  }
}
export const xpForLevel = (level: number) => XP_TABLE[Math.max(1, Math.min(MAX_LEVEL, level))];

export function levelOf(xp: number): number {
  let lo = 1, hi = MAX_LEVEL;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (xp >= XP_TABLE[mid]) lo = mid; else hi = mid - 1;
  }
  return lo;
}
export const skillXp = (s: GameState, id: SkillId) => s.meta.skills[id] ?? 0;
export const skillLevel = (s: GameState, id: SkillId) => levelOf(skillXp(s, id));

/** True while simulating time spent away; most XP is reduced then. */
let offline = false;
export function setOffline(v: boolean) { offline = v; }
export const isOffline = () => offline;

export function addXp(s: GameState, id: SkillId, amount: number) {
  if (!(amount > 0)) return;
  const b = bonuses(s);
  let mult = (1 + b.xp) * (1 + curioXp(s)) * (1 + 0.5 * (s.run.boons.xp ?? 0));
  if (offline) mult *= (id === 'handsOff' ? 1 : XP.offlineMult) * (1 + b.offlineXp);
  const before = skillLevel(s, id);
  s.meta.skills[id] = skillXp(s, id) + amount * mult;
  const after = skillLevel(s, id);
  if (after > before) {
    const pts = pointsAtLevel(id, after) - pointsAtLevel(id, before);
    toast(`${SKILLS[id].icon} ${SKILLS[id].name} level ${after}!${pts ? ` +${pts} skill point${pts > 1 ? 's' : ''}` : ''}`, pts ? 'epic' : 'good', true);
  }
}

/** XP bonus from Curios (read straight from the data to avoid importing calc.ts here). */
function curioXp(s: GameState) {
  let b = 0;
  for (const [id, n] of Object.entries(s.meta.curios)) if (CURIOS[id]?.effect === 'xp') b += CURIOS[id].value * Math.min(n, CURIO_MAX);
  return b;
}

// ---------------------------------------------------------------- bonuses
let epoch = 0;
let cache: { s: GameState | null; run: unknown; alloc: unknown; epoch: number; b: Record<Stat, number> } =
  { s: null, run: null, alloc: null, epoch: -1, b: zeroStats() };
function zeroStats() { return Object.fromEntries(STATS.map((k) => [k, 0])) as Record<Stat, number>; }
const changed = () => { epoch++; };

/** Sum of every learned node and run perk, by stat. Cached until something changes. */
export function bonuses(s: GameState): Record<Stat, number> {
  if (cache.s === s && cache.run === s.run && cache.alloc === s.meta.alloc && cache.epoch === epoch) return cache.b;
  const b = zeroStats();
  for (const [id, rank] of Object.entries(s.meta.alloc)) {
    const n = NODE_BY_ID[id];
    if (!n || !rank) continue;
    for (const [k, v] of Object.entries(n.effects)) b[k as Stat] += (v ?? 0) * rank;
  }
  for (const p of PERKS) {
    const rank = s.run.perks[p.id] ?? 0;
    if (rank) for (const [k, v] of Object.entries(p.effects)) b[k as Stat] += (v ?? 0) * rank;
  }
  cache = { s, run: s.run, alloc: s.meta.alloc, epoch, b };
  return b;
}

// ---------------------------------------------------------------- points
export const rank = (s: GameState, id: string) => s.meta.alloc[id] ?? 0;
export const treeSpent = (s: GameState, tree: SkillId) =>
  NODES.reduce((a, n) => a + (n.tree === tree ? rank(s, n.id) : 0), 0);
/**
 * Skill points come only from leveling that skill, spread evenly from level 1 to 99,
 * so level 99 gives exactly enough to fully master the tree.
 */
export const pointsAtLevel = (tree: SkillId, level: number) => Math.floor((TREE_MAX[tree] * (level - 1)) / (MAX_LEVEL - 1));
export const treePoints = (s: GameState, tree: SkillId) => pointsAtLevel(tree, skillLevel(s, tree));
export const treeFree = (s: GameState, tree: SkillId) => Math.max(0, treePoints(s, tree) - treeSpent(s, tree));
/** The next level that grants a point in this tree. */
export function nextPointLevel(tree: SkillId, level: number) {
  const now = pointsAtLevel(tree, level);
  for (let l = level + 1; l <= MAX_LEVEL; l++) if (pointsAtLevel(tree, l) > now) return l;
  return MAX_LEVEL;
}

/** Refund any tree that has more points spent than its skill level allows (e.g. after rule changes). */
export function reconcileTrees(s: GameState): boolean {
  let refunded = false;
  for (const t of SKILL_IDS) {
    if (treeSpent(s, t) <= treePoints(s, t)) continue;
    for (const n of NODES) if (n.tree === t) delete s.meta.alloc[n.id];
    refunded = true;
  }
  if (refunded) {
    changed(); // before trimming, so abilitySlots() sees the refunded nodes
    s.meta.loadout = s.meta.loadout.filter((a) => knowsAbility(s, a)).slice(0, abilitySlots(s));
  }
  return refunded;
}

export function learnState(s: GameState, id: string): { ok: boolean; reason: string } {
  const n = NODE_BY_ID[id];
  if (!n) return { ok: false, reason: '' };
  if (rank(s, id) >= n.max) return { ok: false, reason: 'Fully learned.' };
  const need = TIER_REQ[n.tier] ?? 0;
  if (treeSpent(s, n.tree) < need) return { ok: false, reason: `Spend ${need} points in ${SKILLS[n.tree].name} to open tier ${n.tier + 1}.` };
  if (n.req?.length && !n.req.some((r) => rank(s, r) > 0)) {
    return { ok: false, reason: `Requires ${n.req.map((r) => NODE_BY_ID[r].name).join(' or ')}.` };
  }
  if (n.group) {
    const other = NODES.find((o) => o.group === n.group && o.id !== id && rank(s, o.id) > 0);
    if (other) return { ok: false, reason: `You chose ${other.name}. Choices can be changed when you prestige.` };
  }
  if (treeFree(s, n.tree) < 1) {
    const lvl = skillLevel(s, n.tree);
    return { ok: false, reason: `No ${SKILLS[n.tree].name} points. Next point at level ${nextPointLevel(n.tree, lvl)}.` };
  }
  return { ok: true, reason: '' };
}

export function learn(s: GameState, id: string) {
  if (!learnState(s, id).ok) return false;
  s.meta.alloc[id] = rank(s, id) + 1;
  changed();
  const n = NODE_BY_ID[id];
  if (n.ability && s.meta.loadout.length < abilitySlots(s) && !s.meta.loadout.includes(n.ability)) s.meta.loadout.push(n.ability);
  toast(n.ability ? `New ability: ${ABILITIES[n.ability].name}!` : `Learned ${n.name}`, n.ability || n.kind === 'keystone' ? 'epic' : 'good');
  return true;
}

/** Major trees can only be reset when prestiging. */
export function respecTrees(s: GameState) {
  s.meta.alloc = {};
  s.meta.loadout = [];
  changed();
}

// ---------------------------------------------------------------- abilities
export const knowsAbility = (s: GameState, id: AbilityId) => NODES.some((n) => n.ability === id && rank(s, n.id) > 0);
export const abilitySlots = (s: GameState) => 2 + bonuses(s).slots;
export const equipped = (s: GameState, id: AbilityId) => knowsAbility(s, id) && s.meta.loadout.includes(id);
export function toggleEquip(s: GameState, id: AbilityId) {
  const l = s.meta.loadout;
  if (l.includes(id)) s.meta.loadout = l.filter((x) => x !== id);
  else if (knowsAbility(s, id) && l.length < abilitySlots(s)) l.push(id);
  else return false;
  return true;
}

// ---------------------------------------------------------------- run perks
export const perkSpent = (s: GameState) => Object.values(s.run.perks).reduce((a, b) => a + b, 0);
export const perkFree = (s: GameState) => s.run.perkPoints - perkSpent(s);
export function buyPerk(s: GameState, id: string) {
  const p = PERKS.find((x) => x.id === id);
  if (!p || (s.run.perks[id] ?? 0) >= p.max || perkFree(s) < 1) return false;
  s.run.perks[id] = (s.run.perks[id] ?? 0) + 1;
  changed();
  return true;
}
export const perkRespecCost = (s: GameState) => PERK_RESPEC_BASE * Math.pow(3, s.run.perkRespecs);
export function respecPerks(s: GameState) {
  const cost = perkRespecCost(s);
  if (perkSpent(s) === 0 || s.run.res.gold < cost) return false;
  s.run.res.gold -= cost;
  s.run.perks = {};
  s.run.perkRespecs++;
  changed();
  toast('Run perks refunded.', 'good');
  return true;
}
