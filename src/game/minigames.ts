// Mini-games: unlock rules, Goblin Dice, and Curio drops.
import { CURIOS, CURIO_MAX, DICE, GameId, MINIGAMES, RARITIES, Rarity } from '../data/minigames';
import { curioBonus } from './calc';
import { emit, toast } from './events';
import type { GameState } from './state';

const lifetime = (s: GameState, key: string, n: number) => { s.meta.lifetime[key] = (s.meta.lifetime[key] ?? 0) + n; };

/** One mini-game unlocks per prestige. */
export const gameUnlocked = (s: GameState, id: GameId) => MINIGAMES[id].built && s.meta.prestiges >= MINIGAMES[id].prestiges;
export const gamesTabOpen = (s: GameState) => s.meta.prestiges >= 1;
/** The mini-game unlocked by exactly this many prestiges, if any. */
export const gameForPrestige = (n: number) => (Object.keys(MINIGAMES) as GameId[]).find((id) => MINIGAMES[id].prestiges === n);

// ---------------------------------------------------------------- Goblin Dice
export const hasTavern = (s: GameState) => s.run.floors.some((f) => f?.type === 'tavern');
export const diceOpen = (s: GameState) => gameUnlocked(s, 'dice') && hasTavern(s);
/** The bet grows with this run's Expedition progress, like gold income does. */
export const diceStake = (s: GameState) => Math.ceil(DICE.stakeBase * Math.pow(DICE.stakeGrowth, Math.max(0, s.run.maxZone - 1)));
export const diceLuck = (s: GameState) => Math.pow(DICE.streakLuck, s.run.dice.streak) * (1 + curioBonus(s, 'luck'));

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

// ---------------------------------------------------------------- Curios
/** One chance at a Curio from this game's pool, rarest first. Maxed Curios no longer drop. */
export function rollCurio(s: GameState, game: GameId, luck = 1): string | null {
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
  lifetime(s, 'curios', 1);
  const c = CURIOS[id];
  toast(`${RARITIES[c.rarity].name} Curio: ${c.name}!${n > 1 ? ` (copy ${n}/${CURIO_MAX})` : ''}`, c.rarity === 'common' ? 'good' : 'epic');
  emit('curio', id);
}
