// Skills, skill trees and run perks. Add nodes by adding entries; layout is tier / row / col.
import type { AbilityId } from './defs';

export type SkillId = 'combat' | 'digging' | 'colony' | 'handsOn' | 'handsOff';
export const SKILL_IDS: SkillId[] = ['combat', 'digging', 'colony', 'handsOn', 'handsOff'];
export const SKILLS: Record<SkillId, { name: string; icon: string; desc: string }> = {
  combat: { name: 'Combat', icon: '⚔️', desc: 'Earned by defeating monsters.' },
  digging: { name: 'Digging', icon: '⛏️', desc: 'Earned by digging deeper.' },
  colony: { name: 'Colony', icon: '🏠', desc: 'Earned by raising dwarves and building floors.' },
  handsOn: { name: 'Hands-On', icon: '👆', desc: 'Earned by tapping and building combos.' },
  handsOff: { name: 'Hands-Off', icon: '🌙', desc: 'Earned while the colony runs on its own, especially offline.' },
};
export const MAX_LEVEL = 99;
export const POINT_EVERY = 5; // one skill point every 5 levels (20 per skill by level 99)

/** Every stat a node or perk can raise. Percentages are fractions (0.05 = +5%). */
export type Stat =
  | 'dmg' | 'hp' | 'crit' | 'critDmg' | 'speed' | 'killHeal' | 'block' | 'regen' | 'regroup' | 'slots' | 'autoCast'
  | 'dig' | 'stone' | 'ore' | 'storage'
  | 'food' | 'pop' | 'growth' | 'floorCost' | 'gold' | 'know' | 'jobs'
  | 'tap' | 'tapStone' | 'combo' | 'comboWindow'
  | 'offline' | 'offlineXp' | 'xp';
export const STATS: Stat[] = [
  'dmg', 'hp', 'crit', 'critDmg', 'speed', 'killHeal', 'block', 'regen', 'regroup', 'slots', 'autoCast',
  'dig', 'stone', 'ore', 'storage', 'food', 'pop', 'growth', 'floorCost', 'gold', 'know', 'jobs',
  'tap', 'tapStone', 'combo', 'comboWindow', 'offline', 'offlineXp', 'xp',
];

export type NodeKind = 'small' | 'notable' | 'keystone' | 'ability' | 'choice';
export interface NodeDef {
  id: string;
  tree: SkillId;
  tier: number;
  row?: number;
  col: number;
  name: string;
  icon: string;
  desc: string;
  max: number;
  kind: NodeKind;
  effects: Partial<Record<Stat, number>>; // per rank
  ability?: AbilityId;
  req?: string[]; // needs at least one of these learned
  group?: string; // choice nodes: only one per group
}

/** Points that must be spent in a tree before each tier opens. */
export const TIER_REQ = [0, 2, 5, 9];

export const NODES: NodeDef[] = [
  // ---------------------------------------------------------------- Combat
  { id: 'c_str', tree: 'combat', tier: 0, col: 0.5, name: 'Sharpened Sticks', icon: '🗡️', desc: '+5% squad damage per rank.', max: 5, kind: 'small', effects: { dmg: 0.05 } },
  { id: 'c_tough', tree: 'combat', tier: 0, col: -0.5, name: 'Thick Skulls', icon: '🪖', desc: '+5% squad HP per rank.', max: 5, kind: 'small', effects: { hp: 0.05 } },
  { id: 'c_cry', tree: 'combat', tier: 1, col: 0, name: 'Battle Cry', icon: '📣', desc: 'Ability: your squad deals double damage for 10s.', max: 1, kind: 'ability', effects: {}, ability: 'cry', req: ['c_str'] },
  { id: 'c_crit', tree: 'combat', tier: 1, col: 1, name: 'Keen Eye', icon: '🎯', desc: '+1% critical hit chance per rank.', max: 5, kind: 'small', effects: { crit: 0.01 }, req: ['c_str'] },
  { id: 'c_wind', tree: 'combat', tier: 1, col: -1, name: 'Second Wind', icon: '💨', desc: '+5% of max HP healed per kill, per rank.', max: 3, kind: 'small', effects: { killHeal: 0.05 }, req: ['c_tough'] },
  { id: 'c_berserk', tree: 'combat', tier: 2, col: -0.5, name: 'Berserker Stance', icon: '😤', desc: 'Choice: +25% damage, −10% HP.', max: 1, kind: 'choice', group: 'stance', effects: { dmg: 0.25, hp: -0.1 }, req: ['c_cry'] },
  { id: 'c_guard', tree: 'combat', tier: 2, col: 0.5, name: 'Guardian Stance', icon: '🛡️', desc: 'Choice: +25% HP, +10% block.', max: 1, kind: 'choice', group: 'stance', effects: { hp: 0.25, block: 0.1 }, req: ['c_cry'] },
  { id: 'c_wall', tree: 'combat', tier: 2, col: -1.5, name: 'Shield Wall', icon: '🧱', desc: 'Ability: your squad takes 75% less damage for 8s.', max: 1, kind: 'ability', effects: {}, ability: 'wall', req: ['c_wind'] },
  { id: 'c_speed', tree: 'combat', tier: 2, col: 1.5, name: 'Quick Feet', icon: '👟', desc: '+4% attack speed per rank.', max: 5, kind: 'small', effects: { speed: 0.04 }, req: ['c_crit'] },
  { id: 'c_brutal', tree: 'combat', tier: 2, row: 1, col: 1.5, name: 'Brutal Strikes', icon: '💥', desc: '+25% critical damage per rank.', max: 3, kind: 'small', effects: { critDmg: 0.25 }, req: ['c_speed'] },
  { id: 'c_rations', tree: 'combat', tier: 2, row: 1, col: -1.5, name: 'Field Rations', icon: '🥖', desc: 'Your squad recovers 0.5% of max HP per second, per rank.', max: 3, kind: 'small', effects: { regen: 0.005 }, req: ['c_wall'] },
  { id: 'c_tactician', tree: 'combat', tier: 3, col: -1, name: 'Tactician', icon: '🧠', desc: '+1 ability slot.', max: 1, kind: 'notable', effects: { slots: 1 }, req: ['c_rations', 'c_berserk', 'c_guard'] },
  { id: 'c_veteran', tree: 'combat', tier: 3, col: 0, name: 'Veterans', icon: '🎖️', desc: '+15% damage and +15% HP.', max: 1, kind: 'notable', effects: { dmg: 0.15, hp: 0.15 }, req: ['c_berserk', 'c_guard'] },
  { id: 'c_glass', tree: 'combat', tier: 3, col: 1, name: 'Glass Cannon', icon: '🔮', desc: 'Keystone: +100% damage, −50% HP.', max: 1, kind: 'keystone', effects: { dmg: 1, hp: -0.5 }, req: ['c_brutal'] },

  // ---------------------------------------------------------------- Digging
  { id: 'd_arms', tree: 'digging', tier: 0, col: -0.5, name: 'Strong Arms', icon: '💪', desc: '+5% digging per rank.', max: 5, kind: 'small', effects: { dig: 0.05 } },
  { id: 'd_sort', tree: 'digging', tier: 0, col: 0.5, name: 'Rock Sorter', icon: '🪨', desc: '+8% stone per rank.', max: 5, kind: 'small', effects: { stone: 0.08 } },
  { id: 'd_rhythm', tree: 'digging', tier: 1, col: -1, name: 'Steady Rhythm', icon: '🥁', desc: '+8% digging per rank.', max: 3, kind: 'small', effects: { dig: 0.08 }, req: ['d_arms'] },
  { id: 'd_vein', tree: 'digging', tier: 1, col: 0, name: 'Vein Sense', icon: '✨', desc: '+8% copper and iron per rank.', max: 5, kind: 'small', effects: { ore: 0.08 }, req: ['d_arms', 'd_sort'] },
  { id: 'd_crates', tree: 'digging', tier: 1, col: 1, name: 'Packed Crates', icon: '📦', desc: '+10% storage per rank.', max: 5, kind: 'small', effects: { storage: 0.1 }, req: ['d_sort'] },
  { id: 'd_wide', tree: 'digging', tier: 2, col: 0.5, name: 'Wide Swings', icon: '🌀', desc: 'Choice: +30% stone and ore, −10% digging.', max: 1, kind: 'choice', group: 'swing', effects: { stone: 0.3, ore: 0.3, dig: -0.1 }, req: ['d_vein'] },
  { id: 'd_precise', tree: 'digging', tier: 2, col: -0.5, name: 'Precise Picks', icon: '📐', desc: 'Choice: +25% digging, −15% stone.', max: 1, kind: 'choice', group: 'swing', effects: { dig: 0.25, stone: -0.15 }, req: ['d_vein'] },
  { id: 'd_delver', tree: 'digging', tier: 2, col: -1.5, name: 'Deep Delver', icon: '🕳️', desc: '+25% digging.', max: 1, kind: 'notable', effects: { dig: 0.25 }, req: ['d_rhythm'] },
  { id: 'd_hoard', tree: 'digging', tier: 2, col: 1.5, name: 'Hoarder', icon: '🏺', desc: '+50% storage.', max: 1, kind: 'notable', effects: { storage: 0.5 }, req: ['d_crates'] },
  { id: 'd_tunnel', tree: 'digging', tier: 3, col: 0, name: 'Tunnel Vision', icon: '🔦', desc: 'Keystone: +60% digging, −40% stone and ore.', max: 1, kind: 'keystone', effects: { dig: 0.6, stone: -0.4, ore: -0.4 }, req: ['d_delver', 'd_precise', 'd_wide'] },

  // ---------------------------------------------------------------- Colony
  { id: 'o_green', tree: 'colony', tier: 0, col: -0.5, name: 'Green Thumbs', icon: '🍄', desc: '+6% mushrooms per rank.', max: 5, kind: 'small', effects: { food: 0.06 } },
  { id: 'o_beds', tree: 'colony', tier: 0, col: 0.5, name: 'Cozy Beds', icon: '🛏️', desc: '+1 max colonist per rank.', max: 5, kind: 'small', effects: { pop: 1 } },
  { id: 'o_family', tree: 'colony', tier: 1, col: 1, name: 'Big Families', icon: '👪', desc: '+8% colony growth per rank.', max: 5, kind: 'small', effects: { growth: 0.08 }, req: ['o_beds'] },
  { id: 'o_thrift', tree: 'colony', tier: 1, col: 0, name: 'Thrifty Builders', icon: '🔨', desc: '−4% floor costs per rank.', max: 5, kind: 'small', effects: { floorCost: 0.04 }, req: ['o_green', 'o_beds'] },
  { id: 'o_pockets', tree: 'colony', tier: 1, col: -1, name: 'Shiny Pockets', icon: '🪙', desc: '+6% gold per rank.', max: 5, kind: 'small', effects: { gold: 0.06 }, req: ['o_green'] },
  { id: 'o_book', tree: 'colony', tier: 2, col: 0, name: 'Bookish', icon: '📚', desc: '+10% knowledge per rank.', max: 3, kind: 'small', effects: { know: 0.1 }, req: ['o_thrift'] },
  { id: 'o_feast', tree: 'colony', tier: 2, col: -1, name: 'Feast Days', icon: '🍲', desc: 'Choice: +30% mushrooms, −10% growth.', max: 1, kind: 'choice', group: 'society', effects: { food: 0.3, growth: -0.1 }, req: ['o_pockets', 'o_thrift'] },
  { id: 'o_crowd', tree: 'colony', tier: 2, col: 1, name: 'Crowded Halls', icon: '🏘️', desc: 'Choice: +5 max colonists, −10% mushrooms.', max: 1, kind: 'choice', group: 'society', effects: { pop: 5, food: -0.1 }, req: ['o_family', 'o_thrift'] },
  { id: 'o_utopia', tree: 'colony', tier: 3, col: 0, name: 'Mushroom Utopia', icon: '🌈', desc: 'Keystone: +50% growth and mushrooms, −20% digging.', max: 1, kind: 'keystone', effects: { growth: 0.5, food: 0.5, dig: -0.2 }, req: ['o_feast', 'o_crowd', 'o_book'] },

  // ---------------------------------------------------------------- Hands-On
  { id: 'h_knuckle', tree: 'handsOn', tier: 0, col: -0.5, name: 'Divine Knuckles', icon: '👊', desc: '+10% tap power per rank.', max: 5, kind: 'small', effects: { tap: 0.1 } },
  { id: 'h_patience', tree: 'handsOn', tier: 0, col: 0.5, name: 'Patience', icon: '⏳', desc: 'Combo lasts 0.1s longer between taps, per rank.', max: 5, kind: 'small', effects: { comboWindow: 100 } },
  { id: 'h_rubble', tree: 'handsOn', tier: 1, col: -1, name: 'Rubble Rouser', icon: '🧱', desc: '+25% stone from taps per rank.', max: 3, kind: 'small', effects: { tapStone: 0.25 }, req: ['h_knuckle'] },
  { id: 'h_artist', tree: 'handsOn', tier: 1, col: 1, name: 'Combo Artist', icon: '🎨', desc: '+5% maximum combo bonus per rank.', max: 5, kind: 'small', effects: { combo: 0.05 }, req: ['h_patience'] },
  { id: 'h_practice', tree: 'handsOn', tier: 1, col: 0, name: 'Practice', icon: '📈', desc: '+5% XP in every skill per rank.', max: 3, kind: 'small', effects: { xp: 0.05 }, req: ['h_knuckle', 'h_patience'] },
  { id: 'h_frenzy', tree: 'handsOn', tier: 2, col: -0.5, name: 'Frenzy', icon: '🔥', desc: '+30% tap power.', max: 1, kind: 'notable', effects: { tap: 0.3 }, req: ['h_rubble', 'h_practice'] },
  { id: 'h_flow', tree: 'handsOn', tier: 2, col: 0.5, name: 'Flow State', icon: '🌊', desc: '+20% maximum combo bonus and combo lasts 0.5s longer.', max: 1, kind: 'notable', effects: { combo: 0.2, comboWindow: 500 }, req: ['h_artist', 'h_practice'] },
  { id: 'h_god', tree: 'handsOn', tier: 3, col: 0, name: 'Hand of God', icon: '✋', desc: 'Keystone: +200% tap power, −30% output from all jobs.', max: 1, kind: 'keystone', effects: { tap: 2, jobs: -0.3 }, req: ['h_frenzy', 'h_flow'] },

  // ---------------------------------------------------------------- Hands-Off
  { id: 'f_night', tree: 'handsOff', tier: 0, col: -0.5, name: 'Night Shift', icon: '🌜', desc: '+1 hour of offline progress per rank.', max: 5, kind: 'small', effects: { offline: 1 } },
  { id: 'f_clock', tree: 'handsOff', tier: 0, col: 0.5, name: 'Clockwork', icon: '⚙️', desc: '+4% output from all jobs per rank.', max: 5, kind: 'small', effects: { jobs: 0.04 } },
  { id: 'f_dream', tree: 'handsOff', tier: 1, col: -1, name: 'Dream Learning', icon: '💤', desc: '+20% offline XP per rank.', max: 3, kind: 'small', effects: { offlineXp: 0.2 }, req: ['f_night'] },
  { id: 'f_drill', tree: 'handsOff', tier: 1, col: 0, name: 'Drill Instructor', icon: '🎺', desc: 'Your equipped abilities can cast themselves.', max: 1, kind: 'notable', effects: { autoCast: 1 }, req: ['f_night', 'f_clock'] },
  { id: 'f_bell', tree: 'handsOff', tier: 1, col: 1, name: 'Muster Bell', icon: '🔔', desc: 'Squads regroup 10% faster per rank.', max: 3, kind: 'small', effects: { regroup: 0.1 }, req: ['f_clock'] },
  { id: 'f_quarter', tree: 'handsOff', tier: 2, col: -0.5, name: 'Quartermaster', icon: '🎒', desc: '+1 ability slot.', max: 1, kind: 'notable', effects: { slots: 1 }, req: ['f_drill'] },
  { id: 'f_foreman', tree: 'handsOff', tier: 2, col: 0.5, name: 'Foreman', icon: '📋', desc: '+15% output from all jobs.', max: 1, kind: 'notable', effects: { jobs: 0.15 }, req: ['f_drill', 'f_bell'] },
  { id: 'f_autopilot', tree: 'handsOff', tier: 3, col: 0, name: 'Autopilot', icon: '🛸', desc: 'Keystone: +50% output from all jobs, −50% tap power.', max: 1, kind: 'keystone', effects: { jobs: 0.5, tap: -0.5 }, req: ['f_quarter', 'f_foreman'] },
];
export const NODE_BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]));

// ---------------------------------------------------------------- run perks (reset every prestige)
export interface PerkDef { id: string; name: string; icon: string; desc: string; max: number; effects: Partial<Record<Stat, number>> }
export const PERKS: PerkDef[] = [
  { id: 'p_warchest', name: 'War Chest', icon: '⚔️', desc: '+10% squad damage per rank.', max: 5, effects: { dmg: 0.1 } },
  { id: 'p_armor', name: 'Spare Armor', icon: '🛡️', desc: '+10% squad HP per rank.', max: 5, effects: { hp: 0.1 } },
  { id: 'p_lucky', name: 'Lucky Strikes', icon: '🍀', desc: '+2% critical hit chance per rank.', max: 3, effects: { crit: 0.02 } },
  { id: 'p_rally', name: 'Rally', icon: '🚩', desc: '+5% of max HP healed per kill, per rank.', max: 3, effects: { killHeal: 0.05 } },
  { id: 'p_bounty', name: 'Bounty Hunter', icon: '💰', desc: '+15% gold per rank.', max: 5, effects: { gold: 0.15 } },
  { id: 'p_hounds', name: 'Rock Hounds', icon: '⛏️', desc: '+10% digging per rank.', max: 5, effects: { dig: 0.1 } },
  { id: 'p_stew', name: 'Hearty Stew', icon: '🍲', desc: '+10% mushrooms per rank.', max: 5, effects: { food: 0.1 } },
  { id: 'p_recruit', name: 'Fresh Recruits', icon: '🎺', desc: 'Squads regroup 15% faster per rank.', max: 3, effects: { regroup: 0.15 } },
];
export const PERK_POINTS_PER_GUARDIAN = 3;
export const PERK_RESPEC_BASE = 25; // gold; triples with each respec in a run

// ---------------------------------------------------------------- XP sources
export const XP = {
  killBase: 0.4, // × zone^1.1 per kill (zone bosses ×5)
  guardianBase: 100, // × (guardian number)² per guardian
  levelBase: 15, // × 1.1^depth per level dug
  birth: 1, // per new colonist
  build: 6, // per floor built or upgraded
  tap: 0.05, // per tap, plus up to +0.05 more at a 50+ combo (an hour of nonstop tapping ≈ level 14)
  tapXpPerSec: 5, // taps beyond this many per second give no XP
  idlePerSec: 0.01, // Hands-Off while online
  offlinePerSec: 0.03, // Hands-Off while offline (a week away ≈ level 28)
  offlineMult: 0.3, // every other skill while offline
};
