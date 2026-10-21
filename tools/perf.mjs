// Performance check: how long an 8-hour offline catch-up takes on a deep late-game save.
//   npx tsx tools/perf.mjs [botHours=40]
const { play } = await import('./bot.js');
const sim = await import('../src/game/sim.ts');
const ev = await import('../src/game/events.ts');
const a = play({ hours: Number(process.argv[2] ?? 40), taps: 3, activeShare: 0.25, prestiges: 20, prestigeAfterMin: 20 });
const s = a.state;
ev.setQuiet(true);
console.log('save:', JSON.stringify({ depth: s.run.depth, floors: s.run.floors.filter(Boolean).length, zone: s.run.maxZone, pop: Math.floor(s.run.pop), bytes: JSON.stringify(s).length }));
let t0 = performance.now();
sim.catchUp(s, 8 * 3600);
console.log('8h offline catch-up:', ((performance.now() - t0) / 1000).toFixed(2) + 's');
t0 = performance.now();
sim.advance(s, 60);
console.log('60s live advance:', ((performance.now() - t0)).toFixed(1) + 'ms');
