// Dungeon balance check: npx tsx tools/dungeon-test.mjs [hours=4]
const { play } = await import('./bot.js');
const D = await import('../src/game/dungeons.ts');
const ev = await import('../src/game/events.ts');
const hours = Number(process.argv[2] ?? 4);
const a = play({ hours, taps: 3, activeShare: 0.25, prestiges: 3, prestigeAfterMin: 20 });
const s = a.state;
ev.setQuiet(true);
console.log('state:', JSON.stringify({ depth: s.run.depth, zone: s.run.maxZone, prestiges: s.meta.prestiges, guardians: s.run.guardians, caverns: s.meta.lifetime.caverns ?? 0, open: D.dungeonsOpen(s) }));
let won = 0, fled = 0, gold = 0, rooms = 0;
const goldBefore = s.run.res.gold;
for (let i = 0; i < 200; i++) {
  s.run.caverns = [s.run.depth]; s.run.dungeon = null;
  D.enterCavern(s, 0);
  while (s.run.dungeon && !s.run.dungeon.over) D.chooseDoor(s, Math.floor(Math.random() * 3));
  if (s.run.dungeon.over === 'won') won++; else fled++;
  rooms += s.run.dungeon.room; gold += s.run.dungeon.gold;
  s.run.dungeon = null;
}
console.log({ won, fled, avgRooms: rooms / 200, avgGold: Math.round(gold / 200), goldBefore: Math.round(goldBefore), heirlooms: s.meta.lifetime.heirlooms ?? 0, party: (({ size, maxHp, atk }) => ({ size, maxHp: Math.round(maxHp), atk: Math.round(atk) }))(D.partyStats(s)) });
