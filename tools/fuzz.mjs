// Fuzz test: random player actions on bot-grown saves, checking invariants after every step.
//   npx tsx tools/fuzz.mjs [steps=20000] [botHours=6] [prestigeRate=0.05]
// Fails loudly on exceptions, NaN/negative resources, broken colonist counts, or a save that won't round-trip.
const { play } = await import('./bot.js');
const { migrate, newGame } = await import('../src/game/state.ts');
const sim = await import('../src/game/sim.ts');
const A = await import('../src/game/actions.ts');
const calc = await import('../src/game/calc.ts');
const SK = await import('../src/game/skills.ts');
const MG = await import('../src/game/minigames.ts');
const DG = await import('../src/game/dungeons.ts');
const defs = await import('../src/data/defs.ts');
const skd = await import('../src/data/skills.ts');
const ev = await import('../src/game/events.ts');

const steps = Number(process.argv[2] ?? 20000);
const botHours = Number(process.argv[3] ?? 6);
const prestigeRate = Number(process.argv[4] ?? 0.05); // chance a 'prestige' action really prestiges
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rint = (n) => Math.floor(Math.random() * n);

function check(s, label) {
  const r = s.run;
  for (const [k, v] of Object.entries(r.res)) if (!Number.isFinite(v) || v < -1e-6) throw new Error(`${label}: res.${k} = ${v}`);
  if (!Number.isFinite(r.pop) || r.pop < 0) throw new Error(`${label}: pop = ${r.pop}`);
  const jobs = r.jobs.miner + r.jobs.farmer + r.jobs.scholar;
  if (jobs > Math.floor(r.pop) + 1e-9) throw new Error(`${label}: ${jobs} workers but only ${r.pop} colonists`);
  for (const [k, v] of Object.entries(r.jobs)) if (v < 0 || !Number.isInteger(v)) throw new Error(`${label}: jobs.${k} = ${v}`);
  for (const [k, v] of Object.entries(r.combat.plan)) if (v < 0) throw new Error(`${label}: plan.${k} = ${v}`);
  if (!Number.isFinite(r.combat.enemyHp) || !Number.isFinite(r.combat.squadHp)) throw new Error(`${label}: combat NaN`);
  if (!Number.isFinite(s.meta.favor) || s.meta.favor < -1e-6) throw new Error(`${label}: favor = ${s.meta.favor}`);
  const d = calc.derive(s);
  for (const [k, v] of Object.entries(d.rates)) if (!Number.isFinite(v)) throw new Error(`${label}: rate.${k} = ${v}`);
  if (r.dungeon && (!Number.isFinite(r.dungeon.hp) || r.dungeon.hp < 0)) throw new Error(`${label}: dungeon hp ${r.dungeon.hp}`);
  if (r.floors.length !== r.depth) throw new Error(`${label}: ${r.floors.length} floor slots for depth ${r.depth}`);
}

const ACTIONS = [
  ['tap', (s) => A.tapDig(s)],
  ['job', (s) => A.assignJob(s, pick(defs.JOB_IDS), pick([1, -1, 10, -10, 1e9, -1e9]))],
  ['build', (s) => A.buildFloor(s, rint(s.run.depth + 2), pick(defs.FLOOR_IDS))],
  ['upgrade', (s) => A.upgradeFloor(s, rint(s.run.depth + 1))],
  ['demolish', (s) => A.demolishFloor(s, rint(s.run.depth + 1))],
  ['research', (s) => A.buyResearch(s, pick(defs.RESEARCH).id)],
  ['plan', (s) => A.setPlan(s, pick(defs.CLASS_IDS), pick([1, -1, 5, -5, 1e9, -1e9]))],
  ['gear', (s) => A.buyGearLevel(s, pick(['w', 'a']))],
  ['tier', (s) => A.buyGearTier(s, pick(['w', 'a']))],
  ['guardian', (s) => sim.startGuardian(s)],
  ['retry', (s) => sim.retryZoneBoss(s)],
  ['farm', (s) => { s.run.combat.farm = !s.run.combat.farm; }],
  ['ability', (s) => sim.useAbility(s, pick(['cry', 'wall']))],
  ['divine', (s) => A.buyDivine(s, pick(defs.DIVINE).id)],
  ['learn', (s) => SK.learn(s, pick(skd.NODES).id)],
  ['perk', (s) => SK.buyPerk(s, pick(skd.PERKS).id)],
  ['perkRespec', (s) => SK.respecPerks(s)],
  ['equip', (s) => SK.toggleEquip(s, pick(['cry', 'wall']))],
  ['dice', (s) => MG.diceRoll(s)],
  ['diceCash', (s) => MG.diceCashOut(s)],
  ['plinko', (s) => MG.plinkoDrop(s, rint(12) - 1)],
  ['cart', (s) => MG.cartStart(s)],
  ['cartFork', (s) => MG.cartFork(s, pick(['sturdy', 'rickety']))],
  ['cartCash', (s) => MG.cartCashOut(s)],
  ['wheel', (s) => MG.wheelSpin(s)],
  ['explore', (s) => DG.enterCavern(s, rint(4) - 1)],
  ['door', (s) => DG.chooseDoor(s, rint(4) - 1)],
  ['leave', (s) => DG.leaveDungeon(s)],
  ['prestige', (s) => { if (Math.random() < prestigeRate) A.prestige(s, s.run.relics.slice(0, 2), pick(s.meta.races), pick(s.meta.gods), Math.random() < 0.3); }],
  ['wait', (s) => sim.advance(s, pick([0.25, 1, 5, 30]))],
  ['away', (s) => { if (Math.random() < 0.02) sim.catchUp(s, pick([60, 600, 3600])); }],
];

ev.setQuiet(true);
const seeds = [newGame(), play({ hours: botHours, taps: 3, prestiges: 4 }).state];
const counts = {};
for (const [si, base] of seeds.entries()) {
  const s = base;
  s.meta.prestiges = Math.max(s.meta.prestiges, 4); // open every mini-game
  s.meta.bestiary.g1 = 1; // open dungeons
  s.meta.favor += 1e4; s.meta.totalFavor += 1e4;
  for (let i = 0; i < steps; i++) {
    const [name, fn] = pick(ACTIONS);
    counts[name] = (counts[name] ?? 0) + 1;
    if (Math.random() < 0.01) s.run.caverns.push(Math.max(10, s.run.depth));
    if (Math.random() < 0.01) { s.run.res.gold += 1e6; s.run.res.stone += 1e4; }
    try { fn(s); check(s, `seed ${si} step ${i} after ${name}`); } catch (e) {
      console.error('FAIL', e.message); console.error(e.stack.split('\n').slice(0, 4).join('\n')); process.exit(1);
    }
  }
  const round = migrate(JSON.parse(JSON.stringify(s)));
  check(round, `seed ${si} after save round-trip`);
  console.log(`seed ${si}: ok after ${steps} actions (depth ${s.run.depth}, zone ${s.run.maxZone}, prestiges ${s.meta.prestiges})`);
}
console.log('actions tried:', JSON.stringify(counts));
