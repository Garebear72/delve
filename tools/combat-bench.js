// Combat balance bench. Paste into the browser console on the dev server (npm run dev)
// or run via the Browser pane: it simulates fights headlessly and prints how far squads get.
const { newGame } = await import('../src/game/state.ts');
const { advance, startGuardian } = await import('../src/game/sim.ts');
const { setQuiet } = await import('../src/game/events.ts');
setQuiet(true);

function setup({ squad, wLvl = 0, aLvl = 0, wTier = 0, aTier = 0, research = [] }) {
  const s = newGame();
  const r = s.run;
  r.combatUnlocked = true;
  // A realistic early colony: ~18 dwarves max, so every wipe costs colonists that must regrow.
  r.res.food = 100;
  r.research = research;
  r.floors = [{ type: 'barracks', level: 3 }, { type: 'farm', level: 3 }, { type: 'bunk', level: 3 }];
  r.depth = 3;
  r.pop = 18;
  r.jobs.farmer = 3; // keep everyone fed
  Object.assign(r.gear, { wLvl, aLvl, wTier, aTier });
  r.combat.plan = { recruit: 0, fighter: 0, cleric: 0, wizard: 0, ...squad };
  return s;
}

export function push(opts, minutes = 15) {
  const s = setup(opts);
  advance(s, minutes * 60);
  return { maxZone: s.run.maxZone, zoneNow: s.run.combat.zone, wipes: s.meta.lifetime.wipes ?? 0 };
}

export function guardian(opts, index = 0) {
  const s = setup(opts);
  advance(s, 10); // let the squad form
  s.run.depth = [8, 20, 35, 55][index];
  s.run.guardians = [...Array(index).keys()];
  startGuardian(s);
  for (let t = 0; t < 600 && s.run.combat.mode === 'guardian'; t++) advance(s, 1);
  return s.run.guardians.includes(index) ? 'WIN' : 'LOSE';
}
