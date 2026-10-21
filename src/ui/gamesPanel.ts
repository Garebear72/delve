// The Games tab: mini-games (one unlocks per prestige) and the Curio collection.
import { BOONS, BOON_IDS, BoonId, CART, CURIOS, CURIO_MAX, CurioSource, curioDesc, DICE, GameId, GAME_IDS, MINIGAMES, PLINKO, RARITIES } from '../data/minigames';
import {
  boon, cartStake, diceLuck, gameLuck, diceOpen, diceStake, freeSpinsLeft, gameOpen, gameUnlocked, plinkoCost, plinkoGold, VENUES, venueOpen, wheelCost, wheelOpen,
} from '../game/minigames';
import type { GameState } from '../game/state';
import { icon } from '../render/sprites';
import { dungeonView } from './dungeonPanel';
import { fmt } from './format';

const btn = (label: string, act: string, arg: string | number = '', on = true, cls = '') =>
  `<button class="btn ${cls}" data-act="${act}" data-arg="${arg}" ${on ? '' : 'disabled'}>${label}</button>`;

const FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const QUIPS: Record<string, string> = {
  win: '"Hngh. Beginner\'s luck." The goblin squints at your dice.',
  boxcars: '"BOXCARS?!" The goblin flips the table. Then sets it back up, sulking.',
  lose: '"Hehehe. House wins." The goblin pockets your gold.',
  cashout: 'You scoop up your winnings. The goblin pretends not to care.',
  '': '"Fancy a roll, Digging God? Ties go to me. House rules."',
};

/** The Games tab: a card per unlocked game (tap to open its full-screen view), the next teaser, and Curios. */
export function gamesPanel(s: GameState) {
  const cards = GAME_IDS.filter((id) => gameUnlocked(s, id)).map((id) => {
    const g = MINIGAMES[id];
    return `<div class="gamecard" data-act="openGame" data-arg="${id}"><span class="gameicon">${g.icon}</span>
      <div class="grow"><b>${g.name}</b><div class="sub">${g.desc}</div><div class="sub">${gameStatus(s, id)}</div></div>
      <button class="btn epic">Play</button></div>`;
  }).join('');
  // Tease only the next mini-game; later ones stay a mystery.
  const next = GAME_IDS.find((id) => !gameUnlocked(s, id));
  const teaser = next
    ? `<div class="row locked"><div class="grow"><b>🔒 ${MINIGAMES[next].built ? MINIGAMES[next].name : '???'}</b>
        <div class="sub">${MINIGAMES[next].built ? MINIGAMES[next].desc + ' ' : 'Something is being built in the dark. '}Unlocks at prestige ${MINIGAMES[next].prestiges}.</div></div></div>`
    : '';
  const luck = gameLuck(s);
  const luckLine = `<div class="sub">Curio luck right now: <b>×${luck.toFixed(2)}</b>${s.run.curiosFound ? ` (${s.run.curiosFound} found this run make the next a little rarer; resets when you prestige)` : ''}.</div>`;
  return `<h2>Games</h2><div class="sub">One new mini-game unlocks with each prestige. They can find <b>Curios</b>: rare, permanent treasures nothing else gives.</div>
    ${luckLine}${cards}${teaser}<h3>Curios</h3>${curioList(s)}`;
}

function gameStatus(s: GameState, id: GameId) {
  if (!venueOpen(s, id)) return `🔒 Needs ${VENUES[id]!.name} built this run`;
  if (id === 'dice') return `Bet ${fmt(diceStake(s))} gold`;
  if (id === 'plinko') return `${fmt(plinkoCost(s))} stone per drop`;
  if (id === 'cart') return `Ride for ${fmt(cartStake(s))} gold`;
  if (id === 'wheel') return freeSpinsLeft(s) ? '✨ Free spin ready!' : `Spin for ${fmt(wheelCost(s))} Favor`;
  return '';
}

/** Full-screen view for one game. The header and the events strip are shared by every game. */
export function arcadeView(s: GameState, id: GameId | 'dungeon', ui: { lastBoon: string; spinning: boolean }) {
  if (id === 'dungeon') {
    return `<div class="arcade-head"><button class="btn" data-act="closeGame">← Back</button><b class="grow">🕳️ Hidden Cavern</b>
      <div class="chip">${icon('i_gold')}<b>${fmt(s.run.res.gold)}</b></div></div><div class="arcade-events" id="arcadeEvents"></div>
      <div class="arcade-body">${dungeonView(s)}</div>`;
  }
  const g = MINIGAMES[id];
  const found = Object.keys(CURIOS).filter((c) => CURIOS[c].game === id);
  const have = found.filter((c) => s.meta.curios[c]).length;
  const body = id === 'dice' ? diceTable(s) : id === 'plinko' ? plinkoView(s) : id === 'cart' ? cartView(s) : wheelView(s, ui);
  const chips = id === 'plinko' ? [['i_stone', s.run.res.stone], ['i_gold', s.run.res.gold]] : id === 'wheel' ? [['i_favor', s.meta.favor]] : [['i_gold', s.run.res.gold]];
  return `<div class="arcade-head">
      <button class="btn" data-act="closeGame">← Back</button>
      <b class="grow">${g.icon} ${g.name}</b>
      ${chips.map(([ic, v]) => `<div class="chip">${icon(ic as string)}<b>${fmt(v as number)}</b></div>`).join('')}
    </div>
    <div class="arcade-events" id="arcadeEvents"></div>
    <div class="arcade-body">${body}</div>
    <div class="arcade-foot sub">Curios from this game: <b>${have} / ${found.length}</b> found · see them in the Games tab or the Book.</div>`;
}

function diceTable(s: GameState) {
  const g = s.run.dice;
  if (!diceOpen(s)) {
    return `<div class="table"><div class="goblin">${icon('goblin')}</div><p class="quip">"Back room's closed. Build a Tavern and I'll set up my table."</p></div>`;
  }
  const stake = diceStake(s);
  const sum = (a: number[]) => a[0] + a[1];
  const dice = g.you.length
    ? `<div class="dice" id="dice-${g.rolls}">
        <div><span class="sub">Goblin</span><b class="faces">${FACES[g.gob[0]]}${FACES[g.gob[1]]}</b><span>${sum(g.gob)}</span></div>
        <div><span class="sub">You</span><b class="faces">${FACES[g.you[0]]}${FACES[g.you[1]]}</b><span>${sum(g.you)}</span></div>
      </div>`
    : '<div class="dice idle"><b class="faces">⚅⚅</b></div>';
  const result = g.result === 'boxcars' ? `<div class="result good">Boxcars! Pot ×${DICE.boxcars}</div>`
    : g.result === 'win' ? `<div class="result good">You win! Pot ×${DICE.payout}</div>`
    : g.result === 'lose' ? '<div class="result neg">You lose the pot.</div>' : '';
  const luck = diceLuck(s);
  const controls = g.pot > 0
    ? `<div class="pot">Pot ${icon('i_gold')}<b>${fmt(g.pot)}</b></div>
       <div class="sub center">Win streak ${g.streak} · Curio luck ×${luck.toFixed(2)}</div>
       <div class="bigbtns">${btn(`Cash out ${fmt(g.pot)}`, 'diceCash', '', true, 'epic big')}${btn('Double or nothing', 'diceRoll', '', true, 'big')}</div>`
    : `<div class="pot">Bet ${icon('i_gold')}<b>${fmt(stake)}</b></div>
       <div class="bigbtns">${btn(`Roll for ${fmt(stake)} gold`, 'diceRoll', '', s.run.res.gold >= stake, 'epic big')}</div>`;
  return `<div class="table">
      <div class="goblin">${icon('goblin')}</div>
      <p class="quip">${QUIPS[g.result] ?? ''}</p>
      ${dice}${result}
    </div>
    ${controls}
    <div class="sub rules">Beat the goblin's total to win ×${DICE.payout}. Ties go to the goblin. Double sixes pay ×${DICE.boxcars}.
      Every roll might turn up a Curio, and each win in a row makes one more likely. The bet grows as your Expedition goes deeper.</div>`;
}

const closedVenue = (s: GameState, id: GameId, text: string) =>
  `<div class="table"><p class="quip">${text}</p><div class="sub">Build ${VENUES[id]!.name} this run to play.</div></div>`;

function plinkoView(s: GameState) {
  const cost = plinkoCost(s);
  const ok = s.run.res.stone >= cost;
  return `<canvas id="arcadeCanvas" class="arcade-canvas tall"></canvas>
    <div class="pot">${ok ? 'Tap the board to drop' : 'Not enough stone'} · ${icon('i_stone')}<b>${fmt(cost)}</b> per drop</div>
    <div class="bigbtns">${btn('Drop in the middle', 'plinkoDrop', 4, ok, 'epic big')}</div>
    <div class="sub rules">Each drop tips ${fmt(cost)} stone down the board for ${fmt(plinkoGold(s))} gold × the slot it lands in.
      Balls that bounce off the sides fall in the gutter. Drops near the middle are safest; the edges chase the ×5 slots (${PLINKO.edgeLuck}× Curio luck).
      Pass through the ✨ golden peg for ${PLINKO.goldenLuck}× Curio luck. It moves after every drop.</div>`;
}

function cartView(s: GameState) {
  if (!gameOpen(s, 'cart')) return '';
  const c = s.run.cart;
  const stake = cartStake(s);
  const quip = c.result === 'crash' ? '💥 CRASH! The cart is in pieces. So is the gold.'
    : c.result === 'cashout' ? '🛑 You hop off and count your gold.'
    : c.result === 'end' ? '🏁 You made it to the end of the line!'
    : c.result === 'riding' ? (c.step ? `Fork ${c.step} survived! Which track next?` : 'The cart is rolling. Pick a track!')
    : 'The cart creaks invitingly.';
  const controls = c.pot > 0 && c.result === 'riding'
    ? `<div class="pot">Pot ${icon('i_gold')}<b>${fmt(c.pot)}</b> · fork ${c.step + 1} of ${CART.forks}</div>
       <div class="bigbtns">
         ${btn(`🪵 Sturdy track · ${Math.round(CART.sturdy.safe * 100)}% safe · ×${CART.sturdy.mult}`, 'cartFork', 'sturdy', true, 'big')}
         ${btn(`⚠️ Rickety track · ${Math.round(CART.rickety.safe * 100)}% safe · ×${CART.rickety.mult}`, 'cartFork', 'rickety', true, 'big')}
         ${btn(`Bail out with ${fmt(c.pot)}`, 'cartCash', '', c.step >= 1, 'epic big')}
       </div>`
    : `<div class="pot">Ride ${icon('i_gold')}<b>${fmt(stake)}</b></div>
       <div class="bigbtns">${btn(`Ride for ${fmt(stake)} gold`, 'cartStart', '', s.run.res.gold >= stake, 'epic big')}</div>`;
  return `<canvas id="arcadeCanvas" class="arcade-canvas"></canvas>
    <p class="quip center">${quip}</p>${controls}
    <div class="sub rules">${CART.forks} forks per ride. Sturdy track is safer; rickety track pays more and builds more Curio luck.
      Every ride ends with a Curio roll, luckier for every fork survived; reach the end for a bonus roll. Bail out any time after the first fork.</div>`;
}

function wheelView(s: GameState, ui: { lastBoon: string; spinning: boolean }) {
  if (!wheelOpen(s)) return closedVenue(s, 'wheel', 'The gods only spin their wheel at a Shrine.');
  const cost = wheelCost(s);
  const free = freeSpinsLeft(s) > 0;
  const result = ui.spinning ? '<div class="result">Spinning…</div>'
    : ui.lastBoon ? `<div class="result" style="color:${BOONS[ui.lastBoon as BoonId].color}">${BOONS[ui.lastBoon as BoonId].name}!</div><div class="sub center">${BOONS[ui.lastBoon as BoonId].desc}</div>` : '';
  const active = BOON_IDS.filter((id) => boon(s, id) > 0).map((id) => `<span class="tag" style="background:${BOONS[id].color};color:#1b1622">${BOONS[id].name}${boon(s, id) > 1 ? ' ×' + boon(s, id) : ''}</span>`).join(' ');
  return `<canvas id="arcadeCanvas" class="arcade-canvas tall"></canvas>${result}
    <div class="bigbtns">${btn(free ? '✨ Free spin!' : `Spin for ${fmt(cost)} Favor`, 'wheelSpin', '', !ui.spinning && s.meta.favor >= cost, 'epic big')}</div>
    ${active ? `<div class="sub center">Blessings this run: ${active}</div>` : ''}
    <div class="sub rules">One free spin every run. Extra spins cost Favor, doubling each time this run. Blessings last until you prestige.</div>`;
}

const sourceName = (src: CurioSource) => (src === 'dungeon' ? 'Hidden Caverns' : MINIGAMES[src].name);

/** Every Curio of the unlocked games (or, with `heirlooms`, every dungeon Heirloom), found or not. */
export function curioList(s: GameState, heirlooms = false) {
  const games = new Set<CurioSource>(heirlooms ? ['dungeon'] : GAME_IDS.filter((id) => gameUnlocked(s, id)));
  const ids = Object.keys(CURIOS).filter((id) => games.has(CURIOS[id].game));
  if (!ids.length) return '<div class="sub">Unlock a mini-game to start finding Curios.</div>';
  const found = ids.filter((id) => s.meta.curios[id]).length;
  return `<div class="sub">${found} / ${ids.length} found · up to ${CURIO_MAX} copies of each count. Common ~1 in ${Math.round(1 / RARITIES.common.chance)}, Rare ~1 in ${Math.round(1 / RARITIES.rare.chance)}, Legendary ~1 in ${Math.round(1 / RARITIES.legendary.chance)} ${heirlooms ? 'rolls (treasure, elites and bosses roll; bosses roll twice with better luck)' : 'plays'}.</div>` +
    ids.map((id) => {
      const c = CURIOS[id], n = s.meta.curios[id] ?? 0;
      const tag = `<span class="tag rar-${c.rarity}">${RARITIES[c.rarity].name}</span>`;
      return n ? `<div class="row">${icon('i_relic')}<div class="grow"><b>${c.name}</b> ${tag}<div class="sub">${c.flavor}</div><div class="sub">${curioDesc(c)} · now +${Math.round(c.value * Math.min(n, CURIO_MAX) * 100)}%</div></div><div class="right"><b>${Math.min(n, CURIO_MAX)}/${CURIO_MAX}</b></div></div>`
        : `<div class="row locked"><div class="grow"><b>???</b> ${tag}<div class="sub">From ${sourceName(c.game)}.</div></div></div>`;
    }).join('');
}
