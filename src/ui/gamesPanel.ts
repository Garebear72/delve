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

export function gamesPanel(s: GameState) {
  const unlocked = GAME_IDS.filter((id) => gameUnlocked(s, id));
  const body = unlocked.map((id) => (id === 'dice' ? diceView(s) : '')).join('');
  // Tease only the next mini-game; later ones stay a mystery.
  const next = GAME_IDS.find((id) => !gameUnlocked(s, id));
  const teaser = next
    ? `<div class="row locked"><div class="grow"><b>🔒 ${MINIGAMES[next].built ? MINIGAMES[next].name : '???'}</b>
        <div class="sub">${MINIGAMES[next].built ? MINIGAMES[next].desc + ' ' : 'Something is being built in the dark. '}Unlocks at prestige ${MINIGAMES[next].prestiges}.</div></div></div>`
    : '';
  return `<h2>Games</h2><div class="sub">One new mini-game unlocks with each prestige. They can find <b>Curios</b>: rare, permanent treasures nothing else gives.</div>
    ${body}${teaser}<h3>Curios</h3>${curioList(s)}`;
}

function diceView(s: GameState) {
  const g = s.run.dice;
  const head = `<h3>${MINIGAMES.dice.icon} ${MINIGAMES.dice.name}</h3>`;
  if (!hasTavern(s)) return `${head}<div class="row locked"><div class="grow"><b>The back room is closed</b><div class="sub">Build a Tavern floor this run and the goblin will set up his table.</div></div></div>`;
  if (!diceOpen(s)) return '';
  const stake = diceStake(s);
  const sum = (a: number[]) => a[0] + a[1];
  const dice = g.you.length
    ? `<div class="dice" id="dice-${g.rolls}">
        <div><span class="sub">You</span><b class="faces">${FACES[g.you[0]]}${FACES[g.you[1]]}</b><span>${sum(g.you)}</span></div>
        <div><span class="sub">Goblin</span><b class="faces">${FACES[g.gob[0]]}${FACES[g.gob[1]]}</b><span>${sum(g.gob)}</span></div>
      </div>`
    : '';
  const result = g.result === 'boxcars' ? `<b class="good">Boxcars! Pot ×${DICE.boxcars}</b>`
    : g.result === 'win' ? `<b class="good">You win! Pot ×${DICE.payout}</b>`
    : g.result === 'lose' ? '<b class="neg">You lose the pot.</b>' : '';
  const luck = diceLuck(s);
  const controls = g.pot > 0
    ? `<div class="kv"><span>Pot</span><span class="grow"></span>${icon('i_gold')}<b class="good">${fmt(g.pot)}</b></div>
       <div class="sub">Win streak ${g.streak} · Curio luck ×${luck.toFixed(2)}. Each win in a row makes Curios more likely.</div>
       <div class="wrap">${btn(`Cash out ${fmt(g.pot)}`, 'diceCash', '', true, 'epic')}${btn('Double or nothing', 'diceRoll', '', true)}</div>`
    : `<div class="kv"><span>Bet</span><span class="grow"></span>${icon('i_gold')}<b>${fmt(stake)}</b><span class="sub">&nbsp;(you have ${fmt(s.run.res.gold)})</span></div>
       <div class="wrap">${btn(`Roll for ${fmt(stake)} gold`, 'diceRoll', '', s.run.res.gold >= stake, 'epic')}</div>
       <div class="sub">Beat the goblin's total to win ×${DICE.payout}. Ties go to the goblin. Double sixes pay ×${DICE.boxcars}. Every roll might turn up a Curio. The bet grows as your Expedition goes deeper.</div>`;
  return `${head}<div class="minigame">${dice}<p class="quip">${QUIPS[g.result] ?? ''}</p>${result ? `<div>${result}</div>` : ''}${controls}</div>`;
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
