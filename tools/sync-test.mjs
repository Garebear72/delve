// Two-device cloud sync scenarios against an in-memory server: npx tsx tools/sync-test.mjs
// Each "device" has its own local save and bookkeeping; they share one fake server.
const { CloudSync } = await import('../src/cloud/sync.ts');
const { MemoryBackend, MemoryServer } = await import('../src/cloud/memory.ts');

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };

function device(name, server, answer = 'cloud') {
  const kv = new Map();
  const dev = {
    name, save: null, // { progress, savedAt } or null
    asked: 0, answer,
    play(progress) { dev.save = { progress, savedAt: Date.now() }; dev.sync.markDirty(1, Date.now() + 1); },
  };
  dev.sync = new CloudSync(new MemoryBackend(server), { get: (k) => kv.get(k) ?? null, set: (k, v) => kv.set(k, v) }, {
    deviceName: name,
    local: () => ({ exists: !!dev.save && dev.save.progress > 0, data: JSON.stringify(dev.save), savedAt: dev.save?.savedAt ?? 0, summary: `p${dev.save?.progress ?? 0}` }),
    apply: (_slot, cloud) => { dev.save = JSON.parse(cloud.data); },
    ask: async () => { dev.asked++; return dev.answer; },
    status: () => {},
  });
  return dev;
}

const tick = () => new Promise((r) => setTimeout(r, 5));

// 1. Phone plays, PC opens fresh: PC downloads the phone's save.
{
  const server = new MemoryServer();
  const phone = device('phone', server), pc = device('pc', server);
  await phone.sync.signIn('gary', 'pw', true);
  phone.play(10);
  ok(await phone.sync.sync(1) === 'push', 'phone uploads its first save');
  pc.save = { progress: 0, savedAt: Date.now() }; // a brand-new game on the PC
  pc.sync.alwaysLatest = true; // even with "always latest", a blank game must not win
  await pc.sync.signIn('gary', 'pw', false);
  ok(await pc.sync.sync(1) === 'pull' && pc.save.progress === 10, 'fresh PC downloads the phone save (blank game never overwrites)');

  // 2. PC plays and uploads; the phone, idle since, quietly downloads it.
  pc.play(15); await tick();
  ok(await pc.sync.sync(1) === 'push', 'PC uploads its progress');
  ok(await phone.sync.sync(1) === 'pull' && phone.save.progress === 15, 'idle phone downloads the newer PC save without asking');

  // 3. Both play without syncing: the second to sync is asked, nothing is overwritten silently.
  phone.play(16); await tick(); pc.play(20);
  await pc.sync.sync(1);
  ok(await phone.sync.sync(1) === 'pull' && phone.asked === 1 && phone.save.progress === 20, 'both changed: phone is asked (chose cloud) and loads the PC save');
  ok(server.saves.get('gary/1').rev === 3, 'cloud rev counts every upload');

  // 4. Same, but the player chooses to keep this device's save.
  phone.answer = 'local';
  pc.play(21); await tick(); phone.play(30);
  await pc.sync.sync(1);
  ok(await phone.sync.sync(1) === 'pushOver' && JSON.parse(server.saves.get('gary/1').data).progress === 30, 'player keeps the phone save: it replaces the cloud copy');
  ok(await pc.sync.sync(1) === 'ask' || pc.save.progress === 30, 'PC then sees the change on its next sync');
}

// 5. "Always use the latest save": whoever played most recently wins, without asking.
{
  const server = new MemoryServer();
  const a = device('a', server), b = device('b', server);
  await a.sync.signIn('u', 'p', true); a.play(5); await a.sync.sync(1);
  await b.sync.signIn('u', 'p', false); await b.sync.sync(1);
  a.sync.alwaysLatest = true; b.sync.alwaysLatest = true;
  b.play(7); await tick(); await b.sync.sync(1);
  await tick(); a.play(9); // a played after b uploaded
  ok(await a.sync.sync(1) === 'pushOver' && a.asked === 0, 'always-latest: the device that played last wins, no prompt');
  b.play(8); // b played earlier than a's upload? no: now. b is latest again
  ok(await b.sync.sync(1) === 'pushOver', 'always-latest: and back again');
}

// 6. A race: another device uploads between this device's read and write.
{
  const server = new MemoryServer();
  const a = device('a', server), b = device('b', server);
  await a.sync.signIn('u', 'p', true); a.play(5); await a.sync.sync(1);
  await b.sync.signIn('u', 'p', false); await b.sync.sync(1);
  a.play(6);
  server.onBetween = () => { server.saves.set('u/1', { ...server.saves.get('u/1'), rev: server.saves.get('u/1').rev + 1, data: JSON.stringify({ progress: 99, savedAt: Date.now() }) }); };
  const r = await a.sync.sync(1);
  ok(r === 'pull' && a.asked === 1, 'a racing upload is refused, re-checked, and the player is asked');
  ok(JSON.parse(server.saves.get('u/1').data).progress === 99, 'the racing save was not overwritten');
}

// 7. Wrong password / taken username are errors, not silent.
{
  const server = new MemoryServer();
  const a = device('a', server), b = device('b', server);
  await a.sync.signIn('taken', 'p', true);
  let err = 0;
  try { await b.sync.signIn('taken', 'x', true); } catch { err++; }
  try { await b.sync.signIn('taken', 'wrong', false); } catch { err++; }
  ok(err === 2, 'taken usernames and wrong passwords are rejected');
}

console.log(failures ? `\n${failures} FAILED` : '\nall sync scenarios passed');
process.exit(failures ? 1 : 0);
