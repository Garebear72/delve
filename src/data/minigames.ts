// Mini-games and Curios (permanent collectibles only mini-games can give).
import type { RelicEffect } from './defs';

export type GameId = 'dice' | 'plinko' | 'cart' | 'wheel';
export const GAME_IDS: GameId[] = ['dice', 'plinko', 'cart', 'wheel'];
/** One mini-game unlocks per prestige, in this order. `built: false` ones are announced but not playable yet. */
export const MINIGAMES: Record<GameId, { name: string; icon: string; desc: string; prestiges: number; built: boolean }> = {
  dice: { name: 'Goblin Dice', icon: '🎲', desc: 'A goblin in the Tavern back room will roll you for gold. He cheats a little.', prestiges: 1, built: true },
  plinko: { name: 'Plinko Ore Drop', icon: '🪨', desc: 'Tip a bucket of stone down the peg board. Where it lands decides the gold you get back.', prestiges: 2, built: true },
  cart: { name: 'Mine-Cart Gamble', icon: '🛒', desc: 'Ride a runaway cart for gold. Pick sturdy or rickety track at every fork, and bail before it crashes.', prestiges: 3, built: true },
  wheel: { name: 'Wheel of the Gods', icon: '🎡', desc: 'Spin for blessings that last the whole run. Or divine embarrassment.', prestiges: 4, built: true },
};

// ---------------------------------------------------------------- Goblin Dice
export const DICE = {
  stakeBase: 50, // gold per bet, before progress scaling
  stakeGrowth: 1.25, // ×this per Expedition zone cleared this run (matches gold income)
  payout: 1.8, // a win multiplies the pot by this (the goblin wins ties: the house edge)
  boxcars: 3, // double sixes multiply the pot by this instead
  streakLuck: 1.5, // Curio luck ×this for every win in the current streak
};

// ---------------------------------------------------------------- Plinko Ore Drop
export const PLINKO = {
  rows: 8, // peg rows; the ball steps one column left or right per row (off the sides = lost in the gutter)
  cols: 9, // drop columns = landing slots
  slots: [5, 2, 1, 0.5, 0.3, 0.5, 1, 2, 5], // gold multipliers per landing slot
  stoneShare: 0.1, // each drop costs this share of your stone storage, or `stoneSeconds` of stone production
  stoneSeconds: 60, // if that's more (never more than your whole storage)...
  minStone: 20, // ...and at least this much
  goldBase: 6, // gold per drop at ×1, scaled like gold income (×1.25 per zone cleared this run)
  edgeLuck: 3, // Curio luck when the ball lands in an outer (×5) slot
  goldenLuck: 3, // Curio luck when the ball passes the golden peg (it moves after every drop)
};

// ---------------------------------------------------------------- Mine-Cart Gamble
export const CART = {
  forks: 4, // forks per ride
  sturdy: { safe: 0.8, mult: 1.2, luck: 1.1 }, // chance to survive the segment, pot ×, Curio luck × per segment
  rickety: { safe: 0.5, mult: 1.8, luck: 1.4 },
  stakeMult: 2, // a ride costs 2 Goblin Dice bets
};

// ---------------------------------------------------------------- Wheel of the Gods
export type BoonId = 'dig' | 'food' | 'gold' | 'dmg' | 'favor' | 'curios' | 'xp' | 'nothing';
export const BOONS: Record<BoonId, { name: string; icon: string; desc: string; color: string; weight: number }> = {
  dig: { name: 'Blessed Pickaxes', icon: '⛏️', desc: 'Digging ×2 for the rest of this run.', color: '#c27b3e', weight: 1 },
  food: { name: "Snorg's Picnic", icon: '🍄', desc: 'Mushrooms ×3 for the rest of this run.', color: '#6abe30', weight: 1 },
  gold: { name: 'Midas Sneeze', icon: '💰', desc: 'Gold ×2 for the rest of this run.', color: '#fbf236', weight: 1 },
  dmg: { name: 'War Hymn', icon: '⚔️', desc: 'Squad damage ×2 for the rest of this run.', color: '#d95763', weight: 1 },
  favor: { name: 'Divine Attention', icon: '✨', desc: '+25% Divine Favor from this run.', color: '#8f56c9', weight: 1 },
  curios: { name: 'Curio Rain', icon: '🎁', desc: 'Three Curio rolls at ×5 luck, from any game you have unlocked.', color: '#5fcde4', weight: 1 },
  xp: { name: 'Wise Owl', icon: '🦉', desc: '+50% XP in every skill for the rest of this run.', color: '#9badb7', weight: 1 },
  nothing: { name: 'Divine Embarrassment', icon: '🙈', desc: 'The gods giggle. Nothing happens.', color: '#4a3d5c', weight: 1 },
};
export const BOON_IDS = Object.keys(BOONS) as BoonId[];
export const WHEEL = {
  freeSpins: 1, // free spins each run
  favorShare: 0.02, // extra spins cost this share of all Favor ever earned...
  minFavor: 5, // ...but at least this much...
  costGrowth: 2, // ...doubling with each paid spin this run
};

// ---------------------------------------------------------------- Curios
export type CurioEffect = RelicEffect | 'all' | 'luck' | 'favor' | 'xp';
export type Rarity = 'common' | 'rare' | 'legendary';
export const RARITIES: Record<Rarity, { name: string; chance: number }> = {
  common: { name: 'Common', chance: 1 / 30 }, // per mini-game play, before luck
  rare: { name: 'Rare', chance: 1 / 300 },
  legendary: { name: 'Legendary', chance: 1 / 3000 },
};
export const CURIO_MAX = 5; // copies of one Curio that count; each copy adds its bonus again
export const CURIO_FATIGUE = 0.9; // mini-game Curio luck × this for every Curio already found this run (resets on prestige)

/** Where a Curio drops: a mini-game, or 'dungeon' for Heirlooms (Curios found only in Hidden Caverns). */
export type CurioSource = GameId | 'dungeon';
export interface CurioDef { name: string; flavor: string; effect: CurioEffect; value: number; rarity: Rarity; game: CurioSource }
const curio = (game: CurioSource, rarity: Rarity, name: string, flavor: string, effect: CurioEffect, value: number): CurioDef =>
  ({ name, flavor, effect, value, rarity, game });
export const CURIOS: Record<string, CurioDef> = {
  // Goblin Dice
  chippedDie: curio('dice', 'common', 'Chipped Die', 'Missing its 4. Rolls 4s anyway, somehow.', 'gold', 0.03),
  goblinIou: curio('dice', 'common', 'Goblin IOU', '"I owe you one (1) mushroom." Signed with a thumbprint.', 'food', 0.03),
  stickyMug: curio('dice', 'common', 'Sticky Tavern Mug', 'It has never been washed. It never will be.', 'growth', 0.03),
  bentCoin: curio('dice', 'common', 'Bent Copper Coin', 'Bent from being bitten to check it was real. It was not.', 'dig', 0.03),
  loadedDie: curio('dice', 'rare', 'Loaded Die', "The goblin's own. He wants it back. He can't have it.", 'luck', 0.1),
  cardSleeve: curio('dice', 'rare', "Card Sharp's Sleeve", 'Seven aces fall out every time you shake it.', 'atk', 0.05),
  bingoDauber: curio('dice', 'rare', "Grandma's Bingo Dauber", 'Smells of lavender and violence.', 'hp', 0.05),
  snakeEyes: curio('dice', 'legendary', 'Snake Eyes in a Jar', 'Two tiny glowing eyes. They blink when you win.', 'all', 0.05),
  // Plinko Ore Drop
  petPebble: curio('plinko', 'common', 'Pet Pebble', 'Answers to "Gerald". Does not answer.', 'dig', 0.03),
  bentPeg: curio('plinko', 'common', 'Bent Peg', 'Fell off the board. The board did not notice.', 'know', 0.03),
  roundOre: curio('plinko', 'common', 'Suspiciously Round Ore', 'Rolls uphill when nobody is looking.', 'gold', 0.03),
  leakyBucket: curio('plinko', 'common', 'Leaky Bucket', 'Holds mushrooms. Mostly.', 'food', 0.03),
  bouncyBall: curio('plinko', 'rare', 'Bouncy Ball', 'Has not stopped bouncing since it was found.', 'luck', 0.1),
  gravityBoot: curio('plinko', 'rare', 'Gravity Boot', 'Very heavy. Only on the left foot.', 'hp', 0.05),
  goldenPeg: curio('plinko', 'rare', 'Golden Peg', 'The gods use these to hang up their coats.', 'favor', 0.04),
  endlessPebble: curio('plinko', 'legendary', 'The Pebble That Never Stops', 'It is still falling. It will always be falling.', 'all', 0.05),
  // Mine-Cart Gamble
  rustyBolt: curio('cart', 'common', 'Rusty Bolt', 'Held the whole track together, apparently.', 'atk', 0.03),
  canary: curio('cart', 'common', 'Canary in a Cage', 'Perfectly healthy. Extremely smug about it.', 'growth', 0.03),
  trackSpike: curio('cart', 'common', 'Track Spike', 'Good for digging. Bad for sitting on.', 'dig', 0.03),
  lunchPail: curio('cart', 'common', 'Lunch Pail', 'Still contains a sandwich. Do not open.', 'food', 0.03),
  brakeLever: curio('cart', 'rare', 'Brake Lever', "Doesn't connect to anything. Pull it for luck.", 'luck', 0.1),
  minersLamp: curio('cart', 'rare', "Miner's Lamp", 'Lights the way. Also lights the eyebrows.', 'xp', 0.05),
  spareWheel: curio('cart', 'rare', 'Spare Wheel', 'A wheel with ambitions.', 'hp', 0.05),
  ghostCart: curio('cart', 'legendary', 'The Ghost Cart', 'It rides at midnight. It carries snacks for the gods.', 'favor', 0.1),
  // Wheel of the Gods
  prayerBead: curio('wheel', 'common', 'Prayer Bead', 'One of many. The rest rolled under the altar.', 'know', 0.03),
  incense: curio('wheel', 'common', 'Divine Incense', 'Smells like toast and good decisions.', 'growth', 0.03),
  candleStub: curio('wheel', 'common', 'Candle Stub', 'Lit by a god. Snuffed by a goblin.', 'gold', 0.03),
  holyWater: curio('wheel', 'common', 'Holy(ish) Water', 'Blessed by a priest. The priest was a frog.', 'hp', 0.03),
  haloShard: curio('wheel', 'rare', 'Halo Shard', 'Still a little bit smug.', 'favor', 0.05),
  pocketPantheon: curio('wheel', 'rare', 'Pocket Pantheon', 'Tiny gods in a tin. They argue all night.', 'luck', 0.1),
  divineMemo: curio('wheel', 'rare', 'Divine Memo', '"Re: the dwarves. Keep an eye on them."', 'xp', 0.05),
  pebbleSock: curio('wheel', 'legendary', "One of Pebble's Socks", 'Pebble has no feet. The mystery deepens.', 'all', 0.05),
  // Heirlooms (Hidden Cavern dungeons only)
  cavernMap: curio('dungeon', 'common', 'Faded Cavern Map', 'X marks the spot. There are forty Xs.', 'dig', 0.03),
  goblinTorch: curio('dungeon', 'common', 'Goblin Torch', 'Burns with a smell best described as "goblin".', 'know', 0.03),
  coinPurse: curio('dungeon', 'common', 'Moldy Coin Purse', 'The coins are fine. The purse has opinions.', 'gold', 0.03),
  heroSandwich: curio('dungeon', 'common', 'Ancient Hero Sandwich', 'Left by a hero. Never finished. Never will be.', 'food', 0.03),
  dragonTooth: curio('dungeon', 'rare', 'Dragon Tooth Dagger', 'Still remembers being a dragon. Bitey.', 'atk', 0.06),
  trollHide: curio('dungeon', 'rare', 'Troll Hide Cloak', 'Regrows when torn. Also when not torn.', 'hp', 0.06),
  treasureCompass: curio('dungeon', 'rare', 'Compass That Points to Treasure', 'Points at you, mostly. Flattering.', 'luck', 0.15),
  sageScroll: curio('dungeon', 'rare', "Sage's Scroll", 'Contains all knowledge. In very small print.', 'xp', 0.06),
  crownOfDepths: curio('dungeon', 'legendary', 'Crown of the Depths', 'Worn by the first Digging God. A bit dented.', 'all', 0.06),
};

export const CURIO_EFFECT_TEXT: Record<CurioEffect, string> = {
  dig: 'digging', food: 'mushrooms', know: 'knowledge', gold: 'gold', atk: 'squad attack', hp: 'squad HP',
  growth: 'colony growth', all: 'all production', luck: 'Curio luck', favor: 'Divine Favor', xp: 'XP in every skill',
};
export const curioDesc = (c: CurioDef) => `+${Math.round(c.value * 100)}% ${CURIO_EFFECT_TEXT[c.effect]} per copy`;
