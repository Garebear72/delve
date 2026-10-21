// Summarise a bot run: per prestige, minutes into the game and depth/zone reached.
// const { summary } = await import('/tools/report.js'); summary({ hours: 12, prestiges: 20 })
const { play } = await import('./bot.js');
export function summary(opts) {
  const t0 = performance.now();
  const a = play(opts);
  const s = a.state;
  const runs = [];
  let p = 0;
  for (; ; p++) {
    const keys = Object.keys(a.first).filter((k) => k.startsWith(`p${p}.`));
    if (!keys.length) break;
    const depths = keys.filter((k) => k.includes('depth')).map((k) => +k.split('depth')[1]);
    const zones = keys.filter((k) => k.includes('zone')).map((k) => +k.split('zone')[1]);
    const g = keys.filter((k) => k.includes('guardian')).map((k) => +k.split('guardian')[1]);
    runs.push(`p${p}: end@${a.prestigeAt[p] ?? a.minutes}m favor=${a.favor[p] ?? '-'} depth>=${Math.max(0, ...depths)} zone>=${Math.max(0, ...zones)} g=${g.length ? Math.max(...g) : -1} worm@${a.first[`p${p}.guardian0`] ?? '-'}${a.sparks[p] ? `  >>> ASCEND +${a.sparks[p]} sparks` : ''}`);
  }
  return { runs, end: a.end, divine: s.meta.divine, celestial: s.meta.celestial, realSec: ((performance.now() - t0) / 1000).toFixed(1), first: a.first };
}
