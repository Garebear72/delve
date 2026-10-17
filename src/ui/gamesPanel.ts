// The Games tab: mini-games (one unlocks per prestige) and the Curio collection.
import { CURIOS, CURIO_MAX, curioDesc, DICE, GameId, GAME_IDS, MINIGAMES, RARITIES } from '../data/minigames';
import { diceLuck, diceOpen, diceStake, gameUnlocked, hasTavern } from '../game/minigames';
import type { GameState } from '../game/state';
import { icon } from '../render/sprites';
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
  return `<h2>Games</h2><div class="sub">One new mini-game unlocks with each prestige. They can find <b>Curios</b>: rare, permanent treasures nothing else gives.</div>
    ${cards}${teaser}<h3>Curios</h3>${curioList(s)}`;
}

function gameStatus(s: GameState, id: GameId) {
  if (id === 'dice') return hasTavern(s) ? `Bet ${fmt(diceStake(s))} gold` : '🔒 Needs a Tavern this run';
  return '';
}

/** Full-screen view for one game. The header and the events strip are shared by every game. */
export function arcadeView(s: GameState, id: GameId) {
  const g = MINIGAMES[id];
  const found = Object.keys(CURIOS).filter((c) => CURIOS[c].game === id);
  const have = found.filter((c) => s.meta.curios[c]).length;
  const body = id === 'dice' ? diceTable(s) : '';
  return `<div class="arcade-head">
      <button class="btn" data-act="closeGame">← Back</button>
      <b class="grow">${g.icon} ${g.name}</b>
      <div class="chip">${icon('i_gold')}<b>${fmt(s.run.res.gold)}</b></div>
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

/** Every Curio of the unlocked games, found or not. */
export function curioList(s: GameState) {
  const games = new Set<GameId>(GAME_IDS.filter((id) => gameUnlocked(s, id)));
  const ids = Object.keys(CURIOS).filter((id) => games.has(CURIOS[id].game));
  if (!ids.length) return '<div class="sub">Unlock a mini-game to start finding Curios.</div>';
  const found = ids.filter((id) => s.meta.curios[id]).length;
  return `<div class="sub">${found} / ${ids.length} found · up to ${CURIO_MAX} copies of each count. Common ~1 in ${Math.round(1 / RARITIES.common.chance)}, Rare ~1 in ${Math.round(1 / RARITIES.rare.chance)}, Legendary ~1 in ${Math.round(1 / RARITIES.legendary.chance)} plays.</div>` +
    ids.map((id) => {
      const c = CURIOS[id], n = s.meta.curios[id] ?? 0;
      const tag = `<span class="tag rar-${c.rarity}">${RARITIES[c.rarity].name}</span>`;
      return n ? `<div class="row">${icon('i_relic')}<div class="grow"><b>${c.name}</b> ${tag}<div class="sub">${c.flavor}</div><div class="sub">${curioDesc(c)} · now +${Math.round(c.value * Math.min(n, CURIO_MAX) * 100)}%</div></div><div class="right"><b>${Math.min(n, CURIO_MAX)}/${CURIO_MAX}</b></div></div>`
        : `<div class="row locked"><div class="grow"><b>???</b> ${tag}<div class="sub">From ${MINIGAMES[c.game].name}.</div></div></div>`;
    }).join('');
}
