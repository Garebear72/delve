// Hidden Cavern dungeons: the list in the Battle tab and the full-screen exploration view.
import { CURIOS } from '../data/minigames';
import { DUNGEON, RoomId, ROOMS } from '../data/dungeons';
import { canExplore, cavernBoss, dungeonsOpen, partyStats } from '../game/dungeons';
import type { GameState } from '../game/state';
import { icon } from '../render/sprites';
import { fmt } from './format';

const btn = (label: string, act: string, arg: string | number = '', on = true, cls = '') =>
  `<button class="btn ${cls}" data-act="${act}" data-arg="${arg}" ${on ? '' : 'disabled'}>${label}</button>`;

/** Battle tab section: caverns found this run, and the one being explored. */
export function cavernsSection(s: GameState) {
  if (!dungeonsOpen(s)) return '';
  const r = s.run;
  const party = partyStats(s);
  const active = r.dungeon
    ? `<div class="row"><div class="grow"><b>🕳️ Exploring the cavern at depth ${r.dungeon.depth}</b><div class="sub">Room ${Math.min(r.dungeon.room + 1, DUNGEON.rooms + 1)} of ${DUNGEON.rooms + 1}</div></div>${btn('Continue', 'openGame', 'dungeon', true, 'epic')}</div>`
    : '';
  const list = r.caverns.map((d, i) => {
    const boss = cavernBoss(d);
    return `<div class="row">${icon(boss.sprite, boss.pal)}<div class="grow"><b>Hidden Cavern · depth ${d}</b><div class="sub">Boss: ${boss.name}</div></div>
      ${btn('Explore', 'explore', i, canExplore(s), 'epic')}</div>`;
  }).join('');
  const empty = !r.caverns.length && !r.dungeon
    ? `<div class="sub">Miners sometimes break into a Hidden Cavern while digging past depth ${DUNGEON.findFrom} (you can hold ${DUNGEON.maxCaverns}).</div>` : '';
  const note = party.size ? `<div class="sub">Your party fights like your squad plan (${party.size} soldiers, ${fmt(party.maxHp)} HP, ${fmt(party.atk)} damage/s) and costs no colonists.</div>`
    : '<div class="sub">Plan a squad first: the party is made of the soldiers in your squad plan.</div>';
  return `<h3>Hidden Caverns <span class="sub">${r.caverns.length} / ${DUNGEON.maxCaverns}</span></h3>${active}${list}${empty}${note}`;
}

/** Full-screen dungeon view (shown in the arcade overlay). */
export function dungeonView(s: GameState) {
  const dg = s.run.dungeon;
  if (!dg) return '<div class="table"><p class="quip">No cavern being explored.</p></div>';
  const boss = cavernBoss(dg.depth);
  const pct = Math.max(0, Math.min(100, (dg.hp / dg.maxHp) * 100));
  const dots = Array.from({ length: DUNGEON.rooms + 1 }, (_, i) =>
    `<span class="dot ${i < dg.room ? 'done' : i === dg.room ? 'here' : ''}">${i === DUNGEON.rooms ? '👑' : ''}</span>`).join('');
  const head = `<div class="dungeon-head">
      <div class="sub">Hidden Cavern · depth ${dg.depth} · gold found ${icon('i_gold')}<b>${fmt(dg.gold)}</b></div>
      <div class="rooms">${dots}</div>
      <div class="hpbar"><span style="width:${pct}%"></span><b>${fmt(dg.hp)} / ${fmt(dg.maxHp)} HP</b></div>
    </div>`;
  const log = `<div class="dlog">${dg.log.map((l, i) => `<div class="${i ? 'sub' : ''}">${l}</div>`).join('')}</div>`;
  if (dg.over) {
    const found = dg.found.map((id) => `<span class="tag rar-${CURIOS[id].rarity}">${CURIOS[id].name}</span>`).join(' ');
    return `${head}<div class="table"><div class="goblin">${icon(boss.sprite, boss.pal)}</div>
        <div class="result ${dg.over === 'won' ? 'good' : 'neg'}">${dg.over === 'won' ? 'Cavern cleared!' : 'Your party retreated'}</div>
        <div class="sub center">You keep ${fmt(dg.gold)} gold${found ? ' and found: ' + found : ''}.</div></div>
      ${log}<div class="bigbtns">${btn('Back to the mine', 'dungeonLeave', '', true, 'epic big')}</div>`;
  }
  if (dg.room >= DUNGEON.rooms) {
    return `${head}<div class="table"><div class="goblin">${icon(boss.sprite, boss.pal)}</div>
        <p class="quip">${boss.name} blocks the way to the cavern's hoard.</p></div>
      <div class="bigbtns">${btn(`👑 Fight ${boss.name}`, 'dungeonDoor', 0, true, 'epic big')}${btn('Retreat with your loot', 'dungeonLeave', '', true, 'big')}</div>${log}`;
  }
  const doors = dg.doors.map((k, i) => {
    const room = ROOMS[k as RoomId];
    return `<button class="door" data-act="dungeonDoor" data-arg="${i}"><span class="dicon">${room.icon}</span><b>${room.name}</b><span class="sub">${room.desc}</span></button>`;
  }).join('');
  return `${head}<p class="quip center">Room ${dg.room + 1} of ${DUNGEON.rooms}. Pick a door.</p>
    <div class="doors">${doors}</div>
    <div class="bigbtns">${btn('Retreat with your loot', 'dungeonLeave', '', true, 'big')}</div>${log}`;
}
