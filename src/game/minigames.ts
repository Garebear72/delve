// Mini-games: unlock rules, Goblin Dice, Plinko Ore Drop, Mine-Cart Gamble, Wheel of the Gods, and Curio drops.
import { BOONS, BOON_IDS, BoonId, CART, CURIOS, CURIO_MAX, CurioSource, DICE, GameId, GAME_IDS, MINIGAMES, PLINKO, RARITIES, Rarity, WHEEL } from '../data/minigames';
import { curioBonus, derive, div, goldMult } from './calc';
import { emit, toast } from './events';
import type { GameState } from './state';

const lifetime = (s: GameState, key: string, n: number) => { s.meta.lifetime[key] = (s.meta.lifetime[key] ?? 0) + n; };
const hasFloor = (s: GameState, type: string) => s.run.floors.some((f) => f?.type === type);

/** One mini-game unlocks per prestige. */
export const gameUnlocked = (s: GameState, id: GameId) => MINIGAMES[id].built && s.meta.prestiges >= MINIGAMES[id].prestiges;
export const gamesTabOpen = (s: GameState) => s.meta.prestiges >= 1;
/** The mini-game unlocked by exactly this many prestiges, if any. */
export const gameForPrestige = (n: number) => (Object.keys(MINIGAMES) as GameId[]).find((id) => MINIGAMES[id].prestiges === n);

/** Some games need a floor built this run before they open (their "venue"). */
export const VENUES: Partial<Record<GameId, { floor: string; name: string }>> = {
  dice: { floor: 'tavern', name: 'a Tavern' },
  wheel: { floor: 'shrine', name: 'a Shrine' },
};
export const venueOpen = (s: GameState, id: GameId) => !VENUES[id] || hasFloor(s, VENUES[id]!.floor);
export const gameOpen = (s: GameState, id: GameId) => gameUnlocked(s, id) && venueOpen(s, id);

/** Curio luck from Curios and the Divine Tree, multiplied into every roll. */
export const baseLuck = (s: GameState) => (1 + curioBonus(s, 'luck')) * (1 + 0.15 * div(s, 'fortune'));

/** Bets grow with this run's Expedition progress, like gold income does. */
const zoneScale = (s: GameState) => Math.pow(DICE.stakeGrowth, Math.max(0, s.run.maxZone - 1));

// ---------------------------------------------------------------- Goblin Dice
export const hasTavern = (s: GameState) => hasFloor(s, 'tavern');
export const diceOpen = (s: GameState) => gameOpen(s, 'dice');
export const diceStake = (s: GameState) => Math.ceil(DICE.stakeBase * zoneScale(s));
export const diceLuck = (s: GameState) => Math.pow(DICE.streakLuck, s.run.dice.streak) * baseLuck(s);

const d6 = () => 1 + Math.floor(Math.random() * 6);

/** Roll: places a fresh bet when nothing is on the table, otherwise risks the whole pot ("double or nothing"). */
export function diceRoll(s: GameState): boolean {
  const g = s.run.dice;
  if (!diceOpen(s)) return false;
  if (g.pot <= 0) {
    const stake = diceStake(s);
    if (s.run.res.gold < stake) return false;
    s.run.res.gold -= stake;
    g.pot = stake;
    g.streak = 0;
  }
  // Curio luck is set by the streak *before* this roll, so pushing your luck pays off.
  const luck = diceLuck(s);
  g.you = [d6(), d6()];
  g.gob = [d6(), d6()];
  g.rolls++;
  lifetime(s, 'dice.rolls', 1);
  const you = g.you[0] + g.you[1], gob = g.gob[0] + g.gob[1];
  if (you === 12) { g.pot *= DICE.boxcars; g.streak++; g.result = 'boxcars'; }
  else if (you > gob) { g.pot *= DICE.payout; g.streak++; g.result = 'win'; }
  else { g.pot = 0; g.streak = 0; g.result = 'lose'; lifetime(s, 'dice.losses', 1); }
  if (g.streak > (s.meta.lifetime['dice.bestStreak'] ?? 0)) s.meta.lifetime['dice.bestStreak'] = g.streak;
  emit('dice', g.result);
  rollCurio(s, 'dice', luck);
  return true;
}

export function diceCashOut(s: GameState): boolean {
  const g = s.run.dice;
  if (g.pot <= 0) return false;
  const won = Math.floor(g.pot);
  s.run.res.gold += won;
  lifetime(s, 'dice.won', won);
  g.pot = 0; g.streak = 0; g.result = 'cashout';
  return true;
}

// ---------------------------------------------------------------- Plinko Ore Drop
export const plinkoCost = (s: GameState) => Math.max(PLINKO.minStone, Math.ceil(PLINKO.stoneShare * derive(s).caps.stone));
export const plinkoGold = (s: GameState) => PLINKO.goldBase * zoneScale(s) * goldMult(s);
export interface PlinkoResult { aim: number; path: number[]; slot: number; mult: number; gold: number; golden: boolean }

/** Move the golden peg to a random spot (row 1..rows-1, a column the ball can actually be in on that row). */
export function moveGoldenPeg(s: GameState) {
  const row = 1 + Math.floor(Math.random() * (PLINKO.rows - 1));
  s.run.plinkoPeg = [row, Math.floor(Math.random() * PLINKO.cols)];
}

/** Drop a ball from column `aim`: it steps one column left or right per row; off either side it's lost in the gutter. */
export function plinkoDrop(s: GameState, aim: number): PlinkoResult | null {
  if (!gameOpen(s, 'plinko')) return null;
  const cost = plinkoCost(s);
  if (s.run.res.stone < cost) return null;
  s.run.res.stone -= cost;
  const last = PLINKO.cols - 1;
  let pos = Math.max(0, Math.min(last, Math.round(aim)));
  const path = [pos];
  const [pr, pc] = s.run.plinkoPeg;
  let golden = false;
  for (let i = 0; i < PLINKO.rows; i++) {
    pos += Math.random() < 0.5 ? -1 : 1;
    path.push(pos);
    if (pos < 0 || pos > last) break; // into the gutter
    if (i + 1 === pr && pos === pc) golden = true;
  }
  const lost = pos < 0 || pos > last;
  const mult = lost ? 0 : PLINKO.slots[pos];
  const gold = plinkoGold(s) * mult;
  s.run.res.gold += gold;
  lifetime(s, 'plinko.drops', 1);
  if (mult >= 5) lifetime(s, 'plinko.jackpots', 1);
  if (lost) lifetime(s, 'plinko.gutters', 1);
  if (golden) lifetime(s, 'plinko.golden', 1);
  const res = { aim: path[0], path, slot: lost ? -1 : pos, mult, gold, golden };
  emit('plinko', res);
  rollCurio(s, 'plinko', (mult >= 5 ? PLINKO.edgeLuck : 1) * (golden ? PLINKO.goldenLuck : 1) * baseLuck(s));
  moveGoldenPeg(s);
  return res;
}

// ---------------------------------------------------------------- Mine-Cart Gamble
export const cartStake = (s: GameState) => Math.ceil(diceStake(s) * CART.stakeMult);

export function cartStart(s: GameState): boolean {
  const c = s.run.cart;
  if (!gameOpen(s, 'cart') || c.pot > 0) return false;
  const stake = cartStake(s);
  if (s.run.res.gold < stake) return false;
  s.run.res.gold -= stake;
  Object.assign(c, { pot: stake, step: 0, path: [], luck: 1, result: 'riding' });
  c.rides++;
  lifetime(s, 'cart.rides', 1);
  emit('cart', 'start');
  return true;
}

/** Take the next fork. Sturdy track is safer; rickety track pays (and lucks) more. */
export function cartFork(s: GameState, kind: 'sturdy' | 'rickety'): boolean {
  const c = s.run.cart;
  if (c.pot <= 0 || c.result !== 'riding') return false;
  const t = CART[kind];
  c.path.push(kind);
  if (Math.random() < t.safe) {
    c.pot *= t.mult;
    c.step++;
    c.luck *= t.luck * 1.25;
    emit('cart', 'safe');
    if (c.step >= CART.forks) endRide(s, 'end');
  } else {
    lifetime(s, 'cart.crashes', 1);
    emit('cart', 'crash');
    endRide(s, 'crash');
  }
  return true;
}

export function cartCashOut(s: GameState): boolean {
  const c = s.run.cart;
  if (c.pot <= 0 || c.result !== 'riding' || c.step < 1) return false;
  endRide(s, 'cashout');
  return true;
}

function endRide(s: GameState, how: 'crash' | 'cashout' | 'end') {
  const c = s.run.cart;
  if (how !== 'crash') {
    const won = Math.floor(c.pot);
    s.run.res.gold += won;
    lifetime(s, 'cart.won', won);
    if (how === 'end') lifetime(s, 'cart.finishes', 1);
  }
  if (c.step > (s.meta.lifetime['cart.bestRide'] ?? 0)) s.meta.lifetime['cart.bestRide'] = c.step;
  const luck = c.luck * baseLuck(s);
  c.pot = 0;
  c.result = how;
  // Every fork survived was another chance at a Curio (luck grows along the ride).
  for (let i = 0; i < Math.max(1, c.step); i++) rollCurio(s, 'cart', luck);
}

// ---------------------------------------------------------------- Wheel of the Gods
export const wheelOpen = (s: GameState) => gameOpen(s, 'wheel');
export const freeSpinsLeft = (s: GameState) => Math.max(0, WHEEL.freeSpins - s.run.wheelSpins);
export const wheelCost = (s: GameState) => freeSpinsLeft(s) > 0 ? 0
  : Math.ceil(Math.max(WHEEL.minFavor, WHEEL.favorShare * s.meta.totalFavor) * Math.pow(WHEEL.costGrowth, s.run.wheelSpins - WHEEL.freeSpins));
export const boon = (s: GameState, id: BoonId) => s.run.boons[id] ?? 0;

/** Spin the wheel: a weighted random blessing for the rest of the run. Returns the boon's index on the wheel. */
export function wheelSpin(s: GameState): number {
  if (!wheelOpen(s)) return -1;
  const cost = wheelCost(s);
  if (s.meta.favor < cost) return -1;
  s.meta.favor -= cost;
  s.run.wheelSpins++;
  lifetime(s, 'wheel.spins', 1);
  const total = BOON_IDS.reduce((a, id) => a + BOONS[id].weight, 0);
  let roll = Math.random() * total, idx = 0;
  for (; idx < BOON_IDS.length - 1; idx++) { roll -= BOONS[BOON_IDS[idx]].weight; if (roll < 0) break; }
  const id = BOON_IDS[idx];
  if (id === 'curios') {
    const pools = GAME_IDS.filter((g) => gameUnlocked(s, g));
    for (let i = 0; i < 3; i++) rollCurio(s, pools[Math.floor(Math.random() * pools.length)], 5 * baseLuck(s));
  } else if (id !== 'nothing') s.run.boons[id] = boon(s, id) + 1;
  emit('wheel', idx);
  rollCurio(s, 'wheel', baseLuck(s));
  return idx;
}

// ---------------------------------------------------------------- Curios
/** One chance at a Curio from this game's pool, rarest first. Maxed Curios no longer drop. */
export function rollCurio(s: GameState, game: CurioSource, luck = 1): string | null {
  for (const rarity of ['legendary', 'rare', 'common'] as Rarity[]) {
    if (Math.random() >= RARITIES[rarity].chance * luck) continue;
    const pool = Object.keys(CURIOS).filter((id) => CURIOS[id].game === game && CURIOS[id].rarity === rarity && (s.meta.curios[id] ?? 0) < CURIO_MAX);
    if (!pool.length) continue;
    const id = pool[Math.floor(Math.random() * pool.length)];
    giveCurio(s, id);
    return id;
  }
  return null;
}

export function giveCurio(s: GameState, id: string) {
  const n = (s.meta.curios[id] ?? 0) + 1;
  s.meta.curios[id] = n;
  const c = CURIOS[id];
  const kind = c.game === 'dungeon' ? 'Heirloom' : 'Curio';
  lifetime(s, c.game === 'dungeon' ? 'heirlooms' : 'curios', 1);
  toast(`${RARITIES[c.rarity].name} ${kind}: ${c.name}!${n > 1 ? ` (copy ${n}/${CURIO_MAX})` : ''}`, c.rarity === 'common' ? 'good' : 'epic');
  emit('curio', id);
}
