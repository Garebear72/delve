// Pacing report from the command line (no browser needed):
//   npx tsx tools/pacing.mjs [hours=48] [prestiges=80]
// Prints, per run, when it ended, the Favor it earned and how deep it got.
const { summary } = await import('./report.js');
const hours = Number(process.argv[2] ?? 48), prestiges = Number(process.argv[3] ?? 80);
const r = summary({ hours, taps: 3, activeShare: 0.25, prestiges, prestigeAfterMin: 20 });
console.log(r.runs.join('\n'));
console.log(JSON.stringify(r.end));
console.log(JSON.stringify(r.divine));
console.log(`(${r.realSec}s)`);
