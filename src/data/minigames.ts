// Mini-games and Curios (permanent collectibles only mini-games can give).
import type { RelicEffect } from './defs';

export type GameId = 'dice' | 'plinko' | 'cart' | 'wheel';
export const GAME_IDS: GameId[] = ['dice', 'plinko', 'cart', 'wheel'];
/** One mini-game unlocks per prestige, in this order. `built: false` ones are announced but not playable yet. */
export const MINIGAMES: Record<GameId, { name: string; icon: string; desc: string; prestiges: number; built: boolean }> = {
  dice: { name: 'Goblin Dice', icon: '🎲', desc: 'A goblin in the Tavern back room will roll you for gold. He cheats a little.', prestiges: 1, built: true },
  plinko: { name: 'Plinko Ore Drop', icon: '🪨', desc: 'Drop ore down a peg board into multiplier slots.', prestiges: 2, built: false },
  cart: { name: 'Mine-Cart Gamble', icon: '🛒', desc: 'Bet on a runaway cart and pick its forks.', prestiges: 3, built: false },
  wheel: { name: 'Wheel of the Gods', icon: '🎡', desc: 'Spin for divine favors. Or divine embarrassment.', prestiges: 4, built: false },
};

// ---------------------------------------------------------------- Goblin Dice
export const DICE = {
  stakeBase: 50, // gold per bet, before progress scaling
  stakeGrowth: 1.25, // ×this per Expedition zone cleared this run (matches gold income)
  payout: 1.8, // a win multiplies the pot by this (the goblin wins ties: the house edge)
  boxcars: 3, // double sixes multiply the pot by this instead
  streakLuck: 1.5, // Curio luck ×this for every win in the current streak
};

// ---------------------------------------------------------------- Curios
export type CurioEffect = RelicEffect | 'all' | 'luck';
export type Rarity = 'common' | 'rare' | 'legendary';
export const RARITIES: Record<Rarity, { name: string; chance: number }> = {
  common: { name: 'Common', chance: 1 / 30 }, // per mini-game play, before luck
  rare: { name: 'Rare', chance: 1 / 300 },
  legendary: { name: 'Legendary', chance: 1 / 3000 },
};
export const CURIO_MAX = 5; // copies of one Curio that count; each copy adds its bonus again

export interface CurioDef { name: string; flavor: string; effect: CurioEffect; value: number; rarity: Rarity; game: GameId }
export const CURIOS: Record<string, CurioDef> = {
  chippedDie: { name: 'Chipped Die', flavor: 'Missing its 4. Rolls 4s anyway, somehow.', effect: 'gold', value: 0.03, rarity: 'common', game: 'dice' },
  goblinIou: { name: 'Goblin IOU', flavor: '"I owe you one (1) mushroom." Signed with a thumbprint.', effect: 'food', value: 0.03, rarity: 'common', game: 'dice' },
  stickyMug: { name: 'Sticky Tavern Mug', flavor: 'It has never been washed. It never will be.', effect: 'growth', value: 0.03, rarity: 'common', game: 'dice' },
  bentCoin: { name: 'Bent Copper Coin', flavor: 'Bent from being bitten to check it was real. It was not.', effect: 'dig', value: 0.03, rarity: 'common', game: 'dice' },
  loadedDie: { name: 'Loaded Die', flavor: "The goblin's own. He wants it back. He can't have it.", effect: 'luck', value: 0.1, rarity: 'rare', game: 'dice' },
  cardSleeve: { name: "Card Sharp's Sleeve", flavor: 'Seven aces fall out every time you shake it.', effect: 'atk', value: 0.05, rarity: 'rare', game: 'dice' },
  bingoDauber: { name: "Grandma's Bingo Dauber", flavor: 'Smells of lavender and violence.', effect: 'hp', value: 0.05, rarity: 'rare', game: 'dice' },
  snakeEyes: { name: 'Snake Eyes in a Jar', flavor: 'Two tiny glowing eyes. They blink when you win.', effect: 'all', value: 0.05, rarity: 'legendary', game: 'dice' },
};

export const CURIO_EFFECT_TEXT: Record<CurioEffect, string> = {
  dig: 'digging', food: 'mushrooms', know: 'knowledge', gold: 'gold', atk: 'squad attack', hp: 'squad HP',
  growth: 'colony growth', all: 'all production', luck: 'Curio luck',
};
export const curioDesc = (c: CurioDef) => `+${Math.round(c.value * 100)}% ${CURIO_EFFECT_TEXT[c.effect]} per copy`;
