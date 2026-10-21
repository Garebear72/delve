// Autoplay bot for pacing checks. Run in the dev server page (Browser pane or console):
//   const { play } = await import('/tools/bot.js');
//   const rep = play({ hours: 6, taps: 2, prestiges: 1 });
// It plays a fresh game greedily (jobs, floors, research, gear, squad, guardians, skills, perks,
// prestige, Divine Tree) and reports when milestones were reached, in minutes of game time.
// `taps` = taps per second while "active" (0 = fully idle). `activeShare` = fraction of each
// minute spent actively tapping (the rest is idle), to model a player who checks in.
const { newGame } = await import('../src/game/state.ts');
const sim = await import('../src/game/sim.ts');
const A = await import('../src/game/actions.ts');
const calc = await import('../src/game/calc.ts');
const SK = await import('../src/game/skills.ts');
const defs = await import('../src/data/defs.ts');
const skd = await import('../src/data/skills.ts');
const ev = await import('../src/game/events.ts');

const FLOOR_PRIORITY = ['farm', 'bunk', 'barracks', 'storage', 'tavern', 'library', 'forge', 'shrine', 'smeltery', 'treasury', 'arena'];

function decide(s, log, t) {
  const r = s.run;
  let d = calc.derive(s);

  // Research everything we can afford, in list order.
  for (const x of defs.RESEARCH) if (!r.research.includes(x.id) && x.req(s)) A.buyResearch(s, x.id);

  // Floors: build on empty levels, wanted types first.
  for (let i = 0; i < r.depth; i++) {
    if (r.floors[i]) continue;
    const counts = Object.fromEntries(defs.FLOOR_IDS.map((f) => [f, r.floors.filter((x) => x?.type === f).length]));
    // Open the Expedition first: nothing else gets built until there's a Barracks.
    if (!r.combatUnlocked && A.floorUnlocked(s, 'barracks')) { A.buildFloor(s, i, 'barracks'); continue; }
    const want = FLOOR_PRIORITY.filter((f) => A.floorUnlocked(s, f))
      .sort((a, b) => counts[a] - counts[b] || FLOOR_PRIORITY.indexOf(a) - FLOOR_PRIORITY.indexOf(b));
    for (const f of want) {
      if (['shrine', 'forge', 'library', 'smeltery', 'treasury', 'arena'].includes(f) && counts[f] >= 2) continue;
      if (A.canAfford(s, A.floorBuildCost(s, f))) { A.buildFloor(s, i, f); break; }
    }
  }
  // Upgrades: cheapest affordable, but keep a stone reserve for new floors.
  for (let k = 0; k < 3; k++) {
    let best = -1, bestCost = Infinity;
    r.floors.forEach((f, i) => {
      if (!f) return;
      const c = A.floorUpgradeCost(s, i);
      const tot = Object.values(c).reduce((a, b) => a + b, 0);
      if (A.canAfford(s, c) && tot < bestCost && tot < (r.res.stone + 1) * 0.8) { best = i; bestCost = tot; }
    });
    if (best < 0) break;
    A.upgradeFloor(s, best);
  }

  // Jobs: keep food positive, ~20% scholars once there's a library, rest miners.
  d = calc.derive(s);
  const pop = Math.floor(r.pop);
  const wantFarm = Math.max(1, Math.ceil((pop * defs.FOOD_PER_COLONIST * 1.25 + d.growth * defs.FOOD_PER_BIRTH) / Math.max(0.01, d.jobRate.farmer)));
  if (r.jobs.farmer > wantFarm + 1) A.assignJob(s, 'farmer', -(r.jobs.farmer - wantFarm));
  d = calc.derive(s);
  if (r.jobs.farmer < wantFarm && d.idle > 0) A.assignJob(s, 'farmer', Math.min(d.idle, wantFarm - r.jobs.farmer));
  d = calc.derive(s);
  // Squad first, if combat is open: reserve colonists for the plan.
  if (r.combatUnlocked) {
    const c = r.combat;
    const unlocked = defs.CLASS_IDS.filter((id) => defs.CLASSES[id].unlock(s));
    const planned = () => Object.values(c.plan).reduce((a, b) => a + b, 0);
    // Keep the plan at 30% fighters, 20% clerics, 30% wizards (recruits fill the rest).
    if (planned() > 0) {
      const cap = d.squadCap;
      const target = { recruit: 0, fighter: 0, cleric: 0, wizard: 0 };
      const share = { fighter: 0.3, cleric: 0.2, wizard: 0.3 };
      let left = cap;
      for (const id of ['fighter', 'cleric', 'wizard']) if (unlocked.includes(id)) { target[id] = Math.floor(cap * share[id]); left -= target[id]; }
      target.recruit = left;
      for (const id of defs.CLASS_IDS) if (c.plan[id] > target[id]) A.setPlan(s, id, -(c.plan[id] - target[id]));
      d = calc.derive(s);
      for (const id of defs.CLASS_IDS) if (c.plan[id] < target[id]) A.setPlan(s, id, target[id] - c.plan[id]);
    } else if (planned() < d.squadCap) {
      A.setPlan(s, 'recruit', d.squadCap - planned());
    }
    d = calc.derive(s);
    // Keep a few spare colonists so wiped squads can re-form.
  }
  const spare = r.combatUnlocked ? Math.ceil(d.squadCap * 0.5) : 0;
  const lib = r.floors.some((f) => f?.type === 'library');
  if (d.idle > spare) {
    const n = d.idle - spare;
    const jobs = r.jobs.miner + r.jobs.farmer + r.jobs.scholar + n;
    const sch = lib ? Math.max(0, Math.min(n, Math.floor(jobs * 0.2) - r.jobs.scholar)) : 0;
    if (sch) A.assignJob(s, 'scholar', sch);
    A.assignJob(s, 'miner', n - sch);
  }
  // If the squad can't form because workers hold everyone, free up miners.
  if (r.combatUnlocked && !r.combat.alive) {
    const need = Object.values(r.combat.plan).reduce((a, b) => a + b, 0);
    d = calc.derive(s);
    if (d.free < need && r.jobs.miner > 2) A.assignJob(s, 'miner', -Math.min(r.jobs.miner - 2, need - d.free));
  }

  // Gear: alternate weapon and armour levels; forge tiers when possible.
  for (const k of ['w', 'a']) if (A.gearTierReady(s, k)) A.buyGearTier(s, k);
  for (let i = 0; i < 20; i++) {
    const g = r.gear;
    const k = g.wLvl <= g.aLvl ? 'w' : 'a';
    if (!A.buyGearLevel(s, k)) break;
  }

  // Combat: guardians and zone-boss retries.
  const c = r.combat;
  d = calc.derive(s);
  if (d.blocked >= 0 && c.alive && c.mode === 'zone' && t - (log._lastG ?? -1e9) > 90) {
    const sq = calc.squadStats(s);
    if (c.squadHp >= sq.maxHp * 0.9) { sim.startGuardian(s); log._lastG = t; }
  }
  if (c.bossHold && t - (log._lastBoss ?? -1e9) > 180) { sim.retryZoneBoss(s); log._lastBoss = t; }

  // Skills and perks: learn the first learnable node in each tree; buy any perk.
  for (const tr of skd.SKILL_IDS) {
    for (let k = 0; k < 5; k++) {
      const n = skd.NODES.filter((x) => x.tree === tr && SK.learnState(s, x.id).ok).sort((a, b) => a.tier - b.tier)[0];
      if (!n) break;
      SK.learn(s, n.id);
    }
  }
  for (const p of skd.PERKS) SK.buyPerk(s, p.id);
  if (s.meta.loadout.length && !c.autoCast) c.autoCast = true;
  for (const ab of ['cry', 'wall']) if (SK.equipped(s, ab)) sim.useAbility(s, ab);
}

function milestones(s, log, t) {
  const r = s.run, m = (k, cond) => { if (cond && log.first[k] === undefined) log.first[k] = +(t / 60).toFixed(1); };
  const p = log.runs; // runs so far (prestiges + Ascensions)
  m(`p${p}.barracks`, r.combatUnlocked);
  for (const z of [5, 10, 15, 20, 30, 40, 50, 60, 70, 85]) m(`p${p}.zone${z}`, r.maxZone >= z);
  for (const dd of [8, 20, 35, 55, 80, 110, 145, 185, 230]) m(`p${p}.depth${dd}`, r.depth >= dd);
  for (let g = 0; g < defs.GUARDIANS.length; g++) m(`p${p}.guardian${g}`, r.guardians.includes(g));
}

// Prestige rule: once allowed, prestige after `prestigeAfterMin` minutes without a new depth or zone
// (the run has stalled), or straight away if pending Favor is at least `favorRatio` × all Favor earned so far.
// Ascension rule (when `ascend`): at a prestige point, Ascend instead if it would give at least
// max(2, Godsparks earned so far), i.e. each Ascension at least doubles your total Godsparks.
export function play({ hours = 4, taps = 0, activeShare = 0.25, prestiges = 0, prestigeAfterMin = 20, favorRatio = 3, ascend = true, state = null } = {}) {
  ev.setQuiet(true);
  const s = state ?? newGame();
  const log = { first: {}, prestigeAt: [], favor: [], sparks: [], runs: 0 };
  const total = hours * 3600;
  let t = 0, lastGain = 0, best = '';
  try {
    while (t < total) {
      // One "minute" of play: tap for activeShare of it (if taps), idle the rest.
      for (let sec = 0; sec < 60; sec++) {
        const active = taps > 0 && sec < 60 * activeShare;
        if (active) for (let k = 0; k < taps; k++) A.tapDig(s);
        sim.advance(s, 1);
        t += 1;
        if (sec % 10 === 0) decide(s, log, t);
      }
      milestones(s, log, t);
      const now = `${s.run.depth}/${s.run.maxZone}`;
      if (now !== best) { best = now; lastGain = t; }
      const d = calc.derive(s);
      if (s.meta.prestiges < prestiges && calc.canPrestige(s, d)) {
        const pend = calc.pendingFavor(s, d);
        if (t - lastGain >= prestigeAfterMin * 60 || pend >= favorRatio * Math.max(10, s.meta.totalFavor)) {
          const fav = calc.pendingFavor(s, d);
          const sparks = calc.pendingSparks(s, d);
          log.prestigeAt.push(+(t / 60).toFixed(1)); log.favor.push(fav); log.runs++;
          if (ascend && calc.canAscend(s, d) && sparks >= Math.max(2, s.meta.totalSparks)) {
            log.sparks.push(sparks);
            A.ascend(s);
            // Spend Godsparks: cheapest Celestial upgrade, repeatedly.
            for (let i = 0; i < 100; i++) {
              const opts = defs.CELESTIAL.filter((x) => x.max === undefined || calc.cel(s, x.id) < x.max).sort((a, b) => A.celestialCost(s, a.id) - A.celestialCost(s, b.id));
              if (!opts.length || !A.buyCelestial(s, opts[0].id)) break;
            }
          } else {
            log.sparks.push(0);
            A.prestige(s, s.run.relics.slice(0, A.reliquarySlots(s)), s.run.race, s.run.god);
          }
          best = ''; lastGain = t;
          // Spend Favor: cheapest Divine upgrade, repeatedly.
          for (let i = 0; i < 100; i++) {
            const opts = defs.DIVINE.filter((x) => x.max === undefined || calc.div(s, x.id) < x.max).sort((a, b) => A.divineCost(s, a.id) - A.divineCost(s, b.id));
            if (!opts.length || !A.buyDivine(s, opts[0].id)) break;
          }
        }
      }
    }
  } finally { ev.setQuiet(false); }
  const r = s.run;
  return {
    minutes: +(t / 60).toFixed(0), first: log.first, prestigeAt: log.prestigeAt, favor: log.favor, sparks: log.sparks,
    end: { depth: r.depth, maxZone: r.maxZone, pop: Math.floor(r.pop), guardians: r.guardians, prestiges: s.meta.prestiges, ascensions: s.meta.ascensions, totalSparks: s.meta.totalSparks,
      skills: Object.fromEntries(skd.SKILL_IDS.map((k) => [k, SK.skillLevel(s, k)])), wipes: s.meta.lifetime.wipes ?? 0 },
    state: s,
  };
}
