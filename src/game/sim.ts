// The simulation: advances the game by dt seconds.
import {
  ABILITIES, AbilityId, ACHIEVEMENTS, BIOMES, BOSS_RELICS, CLASSES, CLASS_IDS, CRIT_CHANCE, ENEMIES, FLOORS, FLOOR_IDS, GUARDIANS, HEAL_PULSE,
  FOOD_PER_BIRTH, GODS, GodId, ITEMS, KILL_HEAL, MAX_VOLLEYS, ORES, RACES, RaceId, RELICS, RESOURCES, RES_IDS, STARVE_INTERVAL, ZONE_CELLS,
} from '../data/defs';
import { derive, Derived, enemyFor, enemyStats, goldMult, hasAbility, hasAutoCast, levelHp, squadStats } from './calc';
import { emit, toast } from './events';
import { addXp, bonuses, isOffline, setOffline } from './skills';
import { PERK_POINTS_PER_GUARDIAN, XP } from '../data/skills';
import type { GameState } from './state';
import { maybeFindCavern } from './dungeons';

const STEP = 0.25;

export function advance(s: GameState, seconds: number) {
  let left = seconds;
  while (left > 0) {
    const dt = Math.min(STEP, left);
    tick(s, derive(s), dt);
    left -= dt;
  }
}

/** Fast-forward for offline time: bigger steps so hours simulate quickly. */
export function catchUp(s: GameState, seconds: number) {
  const step = Math.max(1, seconds / 20000);
  let left = seconds;
  setOffline(true);
  try {
    while (left > 0) {
      const dt = Math.min(step, left);
      tick(s, derive(s), dt);
      left -= dt;
    }
  } finally { setOffline(false); }
}

let achTimer = 0;

export function tick(s: GameState, d: Derived, dt: number) {
  const r = s.run;
  r.time += dt;
  s.meta.time += dt;

  if (d.unionBreak && !r.inBreak) { add(s, 'unionBreaks', 1); toast('☕ Union Break! The goblins down tools for 20 seconds.', 'bad'); }
  if (!d.unionBreak && r.inBreak) toast('Break over. Back to work, comrades.');
  r.inBreak = d.unionBreak;

  // Production
  for (const k of RES_IDS) {
    const rate = d.rates[k];
    if (!rate) continue;
    const before = r.res[k];
    r.res[k] = Math.max(0, Math.min(d.caps[k], before + rate * dt));
    const gained = r.res[k] - before;
    if (gained > 0) add(s, 'res.' + k, gained);
  }

  // Growth (only while fed)
  if (r.pop < d.maxPop && r.res.food > 0) {
    const birthCost = FOOD_PER_BIRTH * Math.max(0.2, 1 - bonuses(s).birthCost);
    const born = Math.min(d.maxPop - r.pop, d.growth * dt, r.res.food / birthCost);
    r.pop += born;
    r.res.food -= born * birthCost;
    addXp(s, 'colony', born * XP.birth);
  }

  // The colony running itself trains Hands-Off (much faster while you're away).
  addXp(s, 'handsOff', dt * (isOffline() ? XP.offlinePerSec : XP.idlePerSec));

  // Starvation: every so often a hungry colonist wanders off (idle ones first). The last two always stay.
  if (d.hungry && r.pop >= 3) {
    r.starve += dt;
    if (r.starve >= STARVE_INTERVAL) {
      r.starve = 0;
      // Unassigned colonists (including ones waiting to join the squad) leave before workers do.
      if (d.free < 1) {
        const job = (['scholar', 'miner', 'farmer'] as const).find((j) => r.jobs[j] > 0);
        if (job) r.jobs[job]--;
      }
      r.pop = Math.max(0, r.pop - 1);
      add(s, 'starved', 1);
      toast('A hungry dwarf wandered off looking for snacks. Get more mushrooms growing!', 'bad');
    }
  } else r.starve = 0;

  // Digging
  if (d.blocked < 0 && d.digPower > 0) {
    r.dig += d.digPower * dt;
    digCheck(s);
  }

  if (r.combatUnlocked) tickCombat(s, d, dt);

  achTimer += dt;
  if (achTimer >= 1) { achTimer = 0; checkProgress(s); }
}

export function digCheck(s: GameState) {
  const r = s.run;
  while (r.dig >= levelHp(r.depth)) {
    // A guardian seals this level: leftover progress is lost rather than banked on the sealed level.
    if (derive(s).blocked >= 0) { r.dig = 0; break; }
    r.dig -= levelHp(r.depth);
    addXp(s, 'digging', XP.levelBase * Math.pow(XP.levelGrowth, r.depth));
    r.depth++;
    r.floors.push(null);
    maybeFindCavern(s, r.depth);
    add(s, 'levels', 1);
    if (r.depth > s.meta.bestDepth) s.meta.bestDepth = r.depth;
    emit('dug', r.depth);
    const b = BIOMES.find((x) => x.from === r.depth);
    if (b) toast(`You broke into the ${b.name}!`, 'epic');
  }
}

export function add(s: GameState, key: string, n: number) {
  s.meta.lifetime[key] = (s.meta.lifetime[key] ?? 0) + n;
}

// ---------------------------------------------------------------- combat
function spawnEnemy(s: GameState) {
  const c = s.run.combat;
  if (c.mode === 'zone') c.enemyId = enemyFor(c.zone, c.cell);
  const e = enemyStats(s);
  c.enemyHp = c.enemyMax = e.hp;
  // The enemy attack clock keeps running across spawns, so fast-killing squads still take hits.
}

export function formSquad(s: GameState, d: Derived) {
  const c = s.run.combat;
  const size = Object.values(c.plan).reduce((a, b) => a + b, 0);
  s.run.pop -= size;
  c.squad = { ...c.plan };
  c.alive = true;
  c.regroup = 0;
  c.eSwing = 0; // a freshly formed squad gets a moment before the first enemy blow
  c.squadHp = squadStats(s).maxHp;
  if (c.enemyHp <= 0) spawnEnemy(s);
  emit('squadFormed');
}

/** Combat always advances in small steps, so long offline steps resolve the same way as live play. */
const COMBAT_STEP = 0.25;
function tickCombat(s: GameState, d: Derived, dt: number) {
  for (let left = dt; left > 1e-9; left -= COMBAT_STEP) combatStep(s, d, Math.min(COMBAT_STEP, left));
}

function combatStep(s: GameState, d: Derived, dt: number) {
  const c = s.run.combat;
  c.cry = Math.max(0, c.cry - dt); c.cryCd = Math.max(0, c.cryCd - dt);
  c.wall = Math.max(0, c.wall - dt); c.wallCd = Math.max(0, c.wallCd - dt);

  if (!c.alive) {
    const size = Object.values(c.plan).reduce((a, b) => a + b, 0);
    // Count free colonists live: d was computed before this tick's sub-steps, and an earlier
    // sub-step may already have formed (and lost) a squad from them.
    const r = s.run;
    const free = Math.floor(r.pop) - (r.jobs.miner + r.jobs.farmer + r.jobs.scholar);
    if (size > 0 && free >= size) {
      c.regroup += dt;
      if (c.regroup >= d.regroupTime) formSquad(s, d);
    } else c.regroup = 0;
    return;
  }

  if (c.autoCast && hasAutoCast(s)) {
    if (c.cryCd <= 0) useAbility(s, 'cry');
    if (c.wallCd <= 0) useAbility(s, 'wall');
  }

  if (c.enemyHp <= 0) spawnEnemy(s);
  const sq = squadStats(s);

  // Each class swings on its own timer. k soldiers of a class split into up to MAX_VOLLEYS
  // evenly spaced volleys, so a few soldiers hit one by one and big groups stay readable.
  for (const id of CLASS_IDS) {
    const k = c.squad[id];
    if (!k) { c.swing[id] = 0; continue; }
    const def = CLASSES[id];
    const volleys = Math.min(k, MAX_VOLLEYS);
    const interval = def.speed / sq.speed / volleys;
    c.swing[id] += dt;
    while (c.swing[id] >= interval && c.alive) {
      c.swing[id] -= interval;
      if (c.enemyHp <= 0) spawnEnemy(s);
      const crit = Math.random() < sq.critChance;
      const vsBoss = c.mode === 'guardian' || c.cell === ZONE_CELLS - 1 ? sq.bossMult : 1;
      const dmg = def.atk * (k / volleys) * sq.atkMult * vsBoss * (crit ? sq.critMult : 1);
      c.enemyHp -= dmg;
      emit('hit', { cls: id, dmg, crit });
      if (c.enemyHp <= 0) onKill(s);
    }
  }

  // The enemy strikes back on its own timer.
  if (c.enemyHp <= 0) spawnEnemy(s);
  const e = enemyStats(s);
  c.eSwing += dt;
  while (c.eSwing >= e.speed && c.alive) {
    c.eSwing -= e.speed;
    const dmg = e.atk * e.speed * (1 - sq.block) * (c.wall > 0 ? 0.25 : 1);
    c.squadHp -= dmg;
    emit('hurt', { dmg });
    if (c.squadHp <= 0) { wipe(s); return; }
  }

  // Healing (Clerics, plus regeneration from skills) arrives in pulses.
  c.healT += dt;
  while (c.healT >= HEAL_PULSE) {
    c.healT -= HEAL_PULSE;
    const amt = Math.min(sq.maxHp - c.squadHp, sq.heal * HEAL_PULSE);
    if (amt > 0) { c.squadHp += amt; emit('heal', { amt, cleric: c.squad.cleric > 0 }); }
  }
  c.squadHp = Math.min(c.squadHp, sq.maxHp);
}

function wipe(s: GameState) {
  const c = s.run.combat;
  c.alive = false;
  c.squadHp = 0;
  c.squad = { recruit: 0, fighter: 0, cleric: 0, wizard: 0 };
  add(s, 'wipes', 1);
  // Whatever won keeps no damage: the next squad faces a fresh enemy.
  c.enemyHp = 0;
  if (c.mode === 'guardian') {
    toast(`${GUARDIANS[c.guardian].name} was too much. Your squad got bonked. Challenge it again when you're ready.`, 'bad');
    c.mode = 'zone'; c.guardian = -1;
  } else if (c.cell === ZONE_CELLS - 1) {
    c.bossHold = true; c.cell = 0;
    toast(`The zone ${c.zone} boss bonked your squad. They'll fight this zone's monsters until you retry the boss.`, 'bad');
  } else toast('Your squad got bonked! Regrouping…', 'bad');
  emit('wipe');
}

export function useAbility(s: GameState, which: AbilityId) {
  const c = s.run.combat;
  if (!c.alive || !hasAbility(s, which)) return;
  const a = ABILITIES[which];
  if (which === 'cry' && c.cryCd <= 0) { c.cry = a.duration; c.cryCd = a.cooldown; emit('ability', 'cry'); }
  if (which === 'wall' && c.wallCd <= 0) { c.wall = a.duration; c.wallCd = a.cooldown; emit('ability', 'wall'); }
}

function onKill(s: GameState) {
  const c = s.run.combat;
  const r = s.run;
  emit('kill');
  add(s, 'kills', 1);

  if (c.mode === 'guardian') {
    const g = GUARDIANS[c.guardian];
    r.guardians.push(c.guardian);
    const first = !s.meta.bestiary['g' + c.guardian];
    s.meta.bestiary['g' + c.guardian] = (s.meta.bestiary['g' + c.guardian] ?? 0) + 1;
    gainRelic(s, g.relic);
    addXp(s, 'combat', XP.guardianBase * Math.pow(c.guardian + 1, 2));
    r.perkPoints += PERK_POINTS_PER_GUARDIAN;
    toast(`${g.name} has fallen! The way down is open. +${PERK_POINTS_PER_GUARDIAN} run perk points.`, 'epic');
    c.mode = 'zone'; c.guardian = -1; c.enemyHp = 0;
    c.squadHp = squadStats(s).maxHp;
    return;
  }

  const id = c.enemyId;
  s.meta.bestiary[id] = (s.meta.bestiary[id] ?? 0) + 1;
  const boss = c.cell === ZONE_CELLS - 1;
  addXp(s, 'combat', XP.killBase * Math.pow(c.zone, 1.1) * (boss ? 5 : 1));
  const gold = Math.pow(1.25, c.zone - 1) * (boss ? 10 : 1) * goldMult(s);
  r.res.gold += gold; add(s, 'res.gold', gold);

  const loot = 1 + bonuses(s).loot;
  const item = ENEMIES[id]?.item;
  if (item && ITEMS[item] && Math.random() < (boss ? 1 : 0.08 * loot)) {
    r.items[item] = (r.items[item] ?? 0) + 1;
    s.meta.collection[item] = (s.meta.collection[item] ?? 0) + 1;
    add(s, 'items', 1);
    emit('loot', item);
  }

  if (boss) {
    if (Math.random() < 0.04 * loot) {
      const missing = BOSS_RELICS.filter((x) => !r.relics.includes(x));
      if (missing.length) gainRelic(s, missing[Math.floor(Math.random() * missing.length)]);
    }
    // First time clearing a zone this run earns a run perk point.
    if (c.zone > r.maxZone) {
      r.maxZone = c.zone;
      r.perkPoints++;
      if (r.maxZone > s.meta.bestZone) s.meta.bestZone = r.maxZone;
      toast(`Zone ${c.zone} cleared! +1 run perk point.`, 'good');
    }
    if (!c.farm) c.zone++;
    c.cell = 0;
    c.squadHp = squadStats(s).maxHp;
  } else {
    c.cell++;
    // After losing to the zone boss, loop the zone's normal monsters until the player retries.
    if (c.bossHold && c.cell === ZONE_CELLS - 1) c.cell = 0;
    // Each victory patches the squad up a bit.
    const sq = squadStats(s);
    const max = sq.maxHp;
    const amt = Math.min(max - c.squadHp, max * sq.killHeal);
    if (amt > 0) { c.squadHp += amt; emit('heal', { amt, cleric: false }); }
  }
  c.enemyHp = 0;
}

function gainRelic(s: GameState, id: string) {
  if (!s.run.relics.includes(id)) s.run.relics.push(id);
  if (!s.meta.relicsFound.includes(id)) s.meta.relicsFound.push(id);
  toast(`Relic found: ${RELICS[id].name}! ${RELICS[id].desc}`, 'epic');
}

export function startGuardian(s: GameState) {
  const d = derive(s);
  const c = s.run.combat;
  if (d.blocked < 0 || !c.alive || c.mode === 'guardian') return;
  c.mode = 'guardian'; c.guardian = d.blocked;
  const g = GUARDIANS[d.blocked];
  c.enemyHp = c.enemyMax = g.hp;
  toast(`${g.name} awakens!`, 'epic');
}

/** Retry the zone boss the squad lost to: it's the next fight (now, or when the squad re-forms). */
export function retryZoneBoss(s: GameState) {
  const c = s.run.combat;
  if (!c.bossHold || c.mode !== 'zone') return;
  c.bossHold = false;
  c.cell = ZONE_CELLS - 1;
  c.enemyHp = 0;
}

// ---------------------------------------------------------------- unlocks & achievements
/** Races and gods unlock permanently when their condition is first met. */
const PATRON_UNLOCKS: { kind: 'race' | 'god'; id: string; check: (s: GameState) => boolean }[] = [
  { kind: 'race', id: 'goblin', check: (s) => s.meta.prestiges >= 1 },
  { kind: 'god', id: 'snorg', check: (s) => s.meta.prestiges >= 1 },
  { kind: 'god', id: 'pebble', check: (s) => (s.meta.lifetime['res.stone'] ?? 0) >= 1000 },
  { kind: 'race', id: 'gnome', check: (s) => s.meta.prestiges >= 3 },
  { kind: 'god', id: 'krog', check: (s) => s.run.guardians.includes(2) },
  { kind: 'race', id: 'kobold', check: (s) => s.meta.bestDepth >= 80 },
  { kind: 'god', id: 'moss', check: (s) => s.meta.prestiges >= 5 },
];
export function checkPatrons(s: GameState) {
  for (const u of PATRON_UNLOCKS) {
    const list = (u.kind === 'race' ? s.meta.races : s.meta.gods) as string[];
    if (list.includes(u.id) || !u.check(s)) continue;
    list.push(u.id);
    const name = u.kind === 'race' ? RACES[u.id as RaceId].name : GODS[u.id as GodId].name;
    toast(u.kind === 'race' ? `New race unlocked: ${name}! Choose them when you prestige.` : `${name} has noticed you. New god unlocked! Choose them when you prestige.`, 'epic');
  }
}
function checkProgress(s: GameState) {
  const r = s.run;
  for (const a of ACHIEVEMENTS) {
    if (!s.meta.achievements.includes(a.id) && a.check(s)) {
      s.meta.achievements.push(a.id);
      emit('achievement', a);
    }
  }
  const once = (id: string, cond: boolean, text: string, kind: 'good' | 'epic' = 'good') => {
    if (cond && !r.seen.includes(id)) { r.seen.push(id); toast(text, kind); }
  };
  for (const f of FLOOR_IDS) {
    if (FLOORS[f].unlockText) {
      const extra = f === 'barracks' ? ' Build one to open the Battle tab.' : '';
      once('floor.' + f, FLOORS[f].unlock(s), `New floor unlocked: ${FLOORS[f].name}!${extra}`);
    }
  }
  for (const o of ORES) once(o.res, r.depth >= BIOMES[o.biome].from, `${RESOURCES[o.res].name}! Miners now haul up ${RESOURCES[o.res].name.toLowerCase()}.`);
  checkPatrons(s);
  // 'divine2': older builds set 'divine' at depth 8, which would hide this announcement on their saves.
  once('divine2', r.guardians.includes(0) && s.meta.prestiges === 0, 'The gods are watching… The Divine tab is open. You can now prestige!', 'epic');
  const g = derive(s).blocked;
  if (g >= 0) once('guard' + g, true, `Something huge blocks the way down: ${GUARDIANS[g].name}. Defeat it in Battle!`, 'epic');
}
