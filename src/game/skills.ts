// Skill levels (RuneScape curve), skill points, tree learning rules, run perks and stat bonuses.
import { ABILITIES, AbilityId } from '../data/defs';
import {
  MAX_LEVEL, NODES, NODE_BY_ID, PERKS, PERK_RESPEC_BASE, SKILLS, SKILL_IDS, SkillId, Stat, STATS, TIER_REQ, XP,
} from '../data/skills';
import { toast } from './events';
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
  let mult = 1 + b.xp;
  if (offline) mult *= (id === 'handsOff' ? 1 : XP.offlineMult) * (1 + b.offlineXp);
  const before = skillLevel(s, id);
  s.meta.skills[id] = skillXp(s, id) + amount * mult;
  const after = skillLevel(s, id);
  if (after > before) {
    const n = after - before;
    toast(`${SKILLS[id].icon} ${SKILLS[id].name} level ${after}! +${n} skill point${n > 1 ? 's' : ''}`, 'good');
  }
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
export const treePoints = (s: GameState, tree: SkillId) => skillLevel(s, tree) - 1;
export const treeFree = (s: GameState, tree: SkillId) => Math.max(0, treePoints(s, tree) - treeSpent(s, tree));

/** General points: one per achievement, two per guardian ever slain, one per 5 best zones, three for prestiging. */
export function generalEarned(s: GameState) {
  const guardians = [0, 1, 2, 3].filter((i) => (s.meta.bestiary['g' + i] ?? 0) > 0).length;
  return s.meta.achievements.length + 2 * guardians + Math.floor(s.meta.bestZone / 5) + (s.meta.prestiges > 0 ? 3 : 0);
}
export function generalFree(s: GameState) {
  const used = SKILL_IDS.reduce((a, t) => a + Math.max(0, treeSpent(s, t) - treePoints(s, t)), 0);
  return Math.max(0, generalEarned(s) - used);
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
  if (treeFree(s, n.tree) < 1 && generalFree(s) < 1) {
    return { ok: false, reason: `No points. Level up ${SKILLS[n.tree].name} or earn general points.` };
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
