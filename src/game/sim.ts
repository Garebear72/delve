// The simulation: advances the game by dt seconds.
import { ACHIEVEMENTS, BIOMES, BOSS_RELICS, ENEMIES, FLOORS, FLOOR_IDS, GUARDIANS, ITEMS, RELICS, RES_IDS, ZONE_CELLS } from '../data/defs';
import { derive, Derived, enemyFor, enemyStats, goldMult, levelHp, squadStats } from './calc';
import { emit, toast } from './events';
import type { GameState } from './state';

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
  while (left > 0) {
    const dt = Math.min(step, left);
    tick(s, derive(s), dt);
    left -= dt;
  }
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
  if (r.pop < d.maxPop && r.res.food > 0) r.pop = Math.min(d.maxPop, r.pop + d.growth * dt);

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
    if (derive(s).blocked >= 0) { r.dig = Math.min(r.dig, levelHp(r.depth)); break; }
    r.dig -= levelHp(r.depth);
    r.depth++;
    r.floors.push(null);
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
}

export function formSquad(s: GameState, d: Derived) {
  const c = s.run.combat;
  const size = Object.values(c.plan).reduce((a, b) => a + b, 0);
  s.run.pop -= size;
  c.squad = { ...c.plan };
  c.alive = true;
  c.regroup = 0;
  c.squadHp = squadStats(s).maxHp;
  if (c.enemyHp <= 0) spawnEnemy(s);
  emit('squadFormed');
}

function tickCombat(s: GameState, d: Derived, dt: number) {
  const c = s.run.combat;
  c.cry = Math.max(0, c.cry - dt); c.cryCd = Math.max(0, c.cryCd - dt);
  c.wall = Math.max(0, c.wall - dt); c.wallCd = Math.max(0, c.wallCd - dt);

  if (!c.alive) {
    const size = Object.values(c.plan).reduce((a, b) => a + b, 0);
    if (size > 0 && d.idle >= size) {
      c.regroup += dt;
      if (c.regroup >= d.regroupTime) formSquad(s, d);
    } else c.regroup = 0;
    return;
  }

  if (c.autoCast && s.run.research.includes('autoCast')) {
    if (c.cryCd <= 0) useAbility(s, 'cry');
    if (c.wallCd <= 0 && s.run.research.includes('shieldWall')) useAbility(s, 'wall');
  }

  if (c.enemyHp <= 0) spawnEnemy(s);
  const sq = squadStats(s);
  const e = enemyStats(s);

  const out = sq.atk * dt;
  c.enemyHp -= out; c.dmgOut += out;
  const incoming = e.atk * (1 - sq.block) * (c.wall > 0 ? 0.25 : 1) * dt;
  const heal = sq.heal * dt;
  c.dmgIn += incoming; c.healed += heal;
  c.squadHp = Math.min(sq.maxHp, c.squadHp - incoming + heal);

  if (c.enemyHp <= 0) onKill(s);
  else if (c.squadHp <= 0) {
    c.alive = false;
    c.squadHp = 0;
    c.squad = { recruit: 0, fighter: 0, cleric: 0, wizard: 0 };
    add(s, 'wipes', 1);
    if (c.mode === 'guardian') {
      toast(`${GUARDIANS[c.guardian].name} was too much. Your squad got bonked.`, 'bad');
      c.mode = 'zone'; c.guardian = -1; c.enemyHp = 0;
    } else toast('Your squad got bonked! Regrouping…', 'bad');
    emit('wipe');
  }
}

export function useAbility(s: GameState, which: 'cry' | 'wall') {
  const c = s.run.combat;
  if (!c.alive) return;
  if (which === 'cry' && c.cryCd <= 0) { c.cry = 10; c.cryCd = 45; emit('ability', 'cry'); }
  if (which === 'wall' && c.wallCd <= 0 && s.run.research.includes('shieldWall')) { c.wall = 8; c.wallCd = 60; emit('ability', 'wall'); }
}

function onKill(s: GameState) {
  const c = s.run.combat;
  const r = s.run;
  emit('kill');
  add(s, 'kills', 1);

  if (c.mode === 'guardian') {
    const g = GUARDIANS[c.guardian];
    r.guardians.push(c.guardian);
    s.meta.bestiary['g' + c.guardian] = (s.meta.bestiary['g' + c.guardian] ?? 0) + 1;
    gainRelic(s, g.relic);
    toast(`${g.name} has fallen! The way down is open.`, 'epic');
    c.mode = 'zone'; c.guardian = -1; c.enemyHp = 0;
    c.squadHp = squadStats(s).maxHp;
    return;
  }

  const id = c.enemyId;
  s.meta.bestiary[id] = (s.meta.bestiary[id] ?? 0) + 1;
  const boss = c.cell === ZONE_CELLS - 1;
  const gold = Math.pow(1.25, c.zone - 1) * (boss ? 10 : 1) * goldMult(s);
  r.res.gold += gold; add(s, 'res.gold', gold);

  const item = ENEMIES[id]?.item;
  if (item && ITEMS[item] && Math.random() < (boss ? 1 : 0.08)) {
    r.items[item] = (r.items[item] ?? 0) + 1;
    s.meta.collection[item] = (s.meta.collection[item] ?? 0) + 1;
    add(s, 'items', 1);
    emit('loot', item);
  }

  if (boss) {
    if (Math.random() < 0.04) {
      const missing = BOSS_RELICS.filter((x) => !r.relics.includes(x));
      if (missing.length) gainRelic(s, missing[Math.floor(Math.random() * missing.length)]);
    }
    if (!c.farm) {
      c.zone++;
      if (c.zone - 1 > r.maxZone) r.maxZone = c.zone - 1;
      if (r.maxZone > s.meta.bestZone) s.meta.bestZone = r.maxZone;
      toast(`Zone ${c.zone - 1} cleared!`, 'good');
    } else if (c.zone > r.maxZone) { r.maxZone = c.zone; }
    c.cell = 0;
    c.squadHp = squadStats(s).maxHp;
  } else c.cell++;
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

// ---------------------------------------------------------------- unlocks & achievements
function checkProgress(s: GameState) {
  const r = s.run;
  for (const a of ACHIEVEMENTS) {
    if (!s.meta.achievements.includes(a.id) && a.check(s)) {
      s.meta.achievements.push(a.id);
      emit('achievement', a);
      if (a.id === 'stone1k' && !s.meta.gods.includes('pebble')) {
        s.meta.gods.push('pebble');
        toast('Pebble, God of Rocks, has noticed your rock enthusiasm. New god unlocked!', 'epic');
      }
    }
  }
  const once = (id: string, cond: boolean, text: string, kind: 'good' | 'epic' = 'good') => {
    if (cond && !r.seen.includes(id)) { r.seen.push(id); toast(text, kind); }
  };
  for (const f of FLOOR_IDS) {
    if (FLOORS[f].unlockText) once('floor.' + f, FLOORS[f].unlock(s), `New floor unlocked: ${FLOORS[f].name}!`);
  }
  once('copper', r.depth >= BIOMES[1].from, 'Copper veins! Miners now haul up copper.');
  once('iron', r.depth >= BIOMES[3].from, 'Iron! Miners now haul up iron.');
  once('divine', r.depth >= 8, 'The gods are watching… The Divine tab is open.', 'epic');
  const g = derive(s).blocked;
  if (g >= 0) once('guard' + g, true, `Something huge blocks the way down: ${GUARDIANS[g].name}. Defeat it in Battle!`, 'epic');
}
