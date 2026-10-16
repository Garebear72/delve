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

/** Every stat a node or perk can raise. Percentages are fractions (0.05 = +5%). */
export type Stat =
  | 'dmg' | 'hp' | 'crit' | 'critDmg' | 'speed' | 'killHeal' | 'block' | 'regen' | 'regroup' | 'slots' | 'autoCast'
  | 'bossDmg' | 'loot' | 'gearCost' | 'squadCap'
  | 'dig' | 'stone' | 'ore' | 'storage'
  | 'food' | 'pop' | 'growth' | 'floorCost' | 'gold' | 'know' | 'jobs' | 'eat' | 'birthCost' | 'researchCost' | 'favor'
  | 'tap' | 'tapStone' | 'combo' | 'comboWindow' | 'tapCrit' | 'tapCritDmg'
  | 'offline' | 'offlineXp' | 'xp' | 'idleJobs';
export const STATS: Stat[] = [
  'dmg', 'hp', 'crit', 'critDmg', 'speed', 'killHeal', 'block', 'regen', 'regroup', 'slots', 'autoCast',
  'bossDmg', 'loot', 'gearCost', 'squadCap',
  'dig', 'stone', 'ore', 'storage',
  'food', 'pop', 'growth', 'floorCost', 'gold', 'know', 'jobs', 'eat', 'birthCost', 'researchCost', 'favor',
  'tap', 'tapStone', 'combo', 'comboWindow', 'tapCrit', 'tapCritDmg',
  'offline', 'offlineXp', 'xp', 'idleJobs',
];

/** How each stat reads in the bonuses summary. 'less' stats are reductions (shown as −X%). */
export const STAT_INFO: Record<Stat, { label: string; unit: 'pct' | 'less' | 'flat' | 'ms' | 'hrs' | 'mult' | 'flag' }> = {
  dmg: { label: 'squad damage', unit: 'pct' }, hp: { label: 'squad HP', unit: 'pct' },
  crit: { label: 'critical hit chance', unit: 'pct' }, critDmg: { label: 'critical damage', unit: 'pct' },
  speed: { label: 'attack speed', unit: 'pct' }, killHeal: { label: 'max HP healed per kill', unit: 'pct' },
  block: { label: 'block', unit: 'pct' }, regen: { label: 'max HP regenerated per second', unit: 'pct' },
  regroup: { label: 'regroup speed', unit: 'pct' }, slots: { label: 'ability slots', unit: 'flat' },
  autoCast: { label: 'Abilities cast themselves', unit: 'flag' },
  bossDmg: { label: 'damage vs bosses and guardians', unit: 'pct' }, loot: { label: 'item and relic drop chance', unit: 'pct' },
  gearCost: { label: 'gear cost', unit: 'less' }, squadCap: { label: 'squad size', unit: 'flat' },
  dig: { label: 'digging', unit: 'pct' }, stone: { label: 'stone', unit: 'pct' }, ore: { label: 'copper and iron', unit: 'pct' },
  storage: { label: 'storage', unit: 'pct' }, food: { label: 'mushrooms', unit: 'pct' }, pop: { label: 'max colonists', unit: 'flat' },
  growth: { label: 'colony growth', unit: 'pct' }, floorCost: { label: 'floor cost', unit: 'less' }, gold: { label: 'gold', unit: 'pct' },
  know: { label: 'knowledge', unit: 'pct' }, jobs: { label: 'output from all jobs', unit: 'pct' },
  eat: { label: 'mushrooms eaten', unit: 'less' }, birthCost: { label: 'mushrooms per new dwarf', unit: 'less' },
  researchCost: { label: 'research cost', unit: 'less' }, favor: { label: 'Divine Favor', unit: 'pct' },
  tap: { label: 'tap power', unit: 'pct' }, tapStone: { label: 'stone from taps', unit: 'pct' },
  combo: { label: 'maximum combo bonus', unit: 'pct' }, comboWindow: { label: 'combo window', unit: 'ms' },
  tapCrit: { label: 'tap crit chance', unit: 'pct' }, tapCritDmg: { label: 'tap crit power', unit: 'mult' },
  offline: { label: 'offline progress', unit: 'hrs' }, offlineXp: { label: 'offline XP', unit: 'pct' },
  xp: { label: 'XP in every skill', unit: 'pct' }, idleJobs: { label: 'job output while left alone', unit: 'pct' },
};

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
export const TIER_REQ = [0, 3, 8, 15, 25, 38];

type Extra = Partial<Pick<NodeDef, 'row' | 'ability' | 'req' | 'group'>>;
const tree = (t: SkillId) =>
  (tier: number, col: number, id: string, name: string, icon: string, desc: string, max: number, kind: NodeKind,
    effects: Partial<Record<Stat, number>>, extra: Extra = {}): NodeDef =>
    ({ id, tree: t, tier, col, name, icon, desc, max, kind, effects, ...extra });

const C = tree('combat'), D = tree('digging'), O = tree('colony'), H = tree('handsOn'), F = tree('handsOff');

export const NODES: NodeDef[] = [
  // ---------------------------------------------------------------- Combat
  C(0, -1, 'c_tough', 'Thick Skulls', '🪖', '+5% squad HP per rank.', 5, 'small', { hp: 0.05 }),
  C(0, 0, 'c_morale', 'Marching Songs', '🎵', '+3% attack speed per rank.', 3, 'small', { speed: 0.03 }),
  C(0, 1, 'c_str', 'Sharpened Sticks', '🗡️', '+5% squad damage per rank.', 5, 'small', { dmg: 0.05 }),
  C(1, -1.5, 'c_wind', 'Second Wind', '💨', '+5% of max HP healed per kill, per rank.', 3, 'small', { killHeal: 0.05 }, { req: ['c_tough'] }),
  C(1, 0, 'c_cry', 'Battle Cry', '📣', 'Ability: your squad deals double damage for 10s.', 1, 'ability', {}, { ability: 'cry', req: ['c_tough', 'c_morale', 'c_str'] }),
  C(1, 1.5, 'c_crit', 'Keen Eye', '🎯', '+1% critical hit chance per rank.', 5, 'small', { crit: 0.01 }, { req: ['c_str'] }),
  C(1, -0.75, 'c_squad', 'Bigger Barracks', '🏕️', '+1 squad size per rank.', 3, 'small', { squadCap: 1 }, { row: 1, req: ['c_tough', 'c_wind'] }),
  C(1, 0.75, 'c_loot', 'Pickpockets', '👝', '+10% item and relic drop chance per rank.', 3, 'small', { loot: 0.1 }, { row: 1, req: ['c_str', 'c_crit'] }),
  C(2, -1.5, 'c_wall', 'Shield Wall', '🧱', 'Ability: your squad takes 75% less damage for 8s.', 1, 'ability', {}, { ability: 'wall', req: ['c_wind', 'c_squad'] }),
  C(2, -0.5, 'c_berserk', 'Berserker Stance', '😤', 'Choice: +25% damage, −10% HP.', 1, 'choice', { dmg: 0.25, hp: -0.1 }, { group: 'stance', req: ['c_cry'] }),
  C(2, 0.5, 'c_guard', 'Guardian Stance', '🛡️', 'Choice: +25% HP, +10% block.', 1, 'choice', { hp: 0.25, block: 0.1 }, { group: 'stance', req: ['c_cry'] }),
  C(2, 1.5, 'c_speed', 'Quick Feet', '👟', '+4% attack speed per rank.', 5, 'small', { speed: 0.04 }, { req: ['c_crit', 'c_loot'] }),
  C(2, -1.5, 'c_rations', 'Field Rations', '🥖', 'Your squad recovers 0.5% of max HP per second, per rank.', 3, 'small', { regen: 0.005 }, { row: 1, req: ['c_wall'] }),
  C(2, 0, 'c_bosses', 'Giant Slayer', '🦴', '+10% damage against bosses and guardians per rank.', 5, 'small', { bossDmg: 0.1 }, { row: 1, req: ['c_berserk', 'c_guard'] }),
  C(2, 1.5, 'c_brutal', 'Brutal Strikes', '💥', '+25% critical damage per rank.', 3, 'small', { critDmg: 0.25 }, { row: 1, req: ['c_speed'] }),
  C(3, -1, 'c_tactician', 'Tactician', '🧠', '+1 ability slot.', 1, 'notable', { slots: 1 }, { req: ['c_rations', 'c_bosses'] }),
  C(3, 0, 'c_veteran', 'Veterans', '🎖️', '+15% damage and +15% HP.', 1, 'notable', { dmg: 0.15, hp: 0.15 }, { req: ['c_bosses'] }),
  C(3, 1, 'c_armory', 'Armorers', '⚒️', 'Gear costs 5% less per rank.', 5, 'small', { gearCost: 0.05 }, { req: ['c_brutal', 'c_bosses'] }),
  C(4, -1, 'c_iron', 'Iron Constitution', '🫀', '+8% squad HP per rank.', 5, 'small', { hp: 0.08 }, { req: ['c_tactician'] }),
  C(4, 0, 'c_precision', 'Precision', '🏹', '+1% critical hit chance per rank.', 5, 'small', { crit: 0.01 }, { req: ['c_veteran'] }),
  C(4, 1, 'c_fury', 'Fury', '🔥', '+8% squad damage per rank.', 5, 'small', { dmg: 0.08 }, { req: ['c_armory', 'c_veteran'] }),
  C(4, -1, 'c_medic', 'Battlefield Medicine', '🩹', '+5% of max HP healed per kill, per rank.', 3, 'small', { killHeal: 0.05 }, { row: 1, req: ['c_iron'] }),
  C(4, 1, 'c_executioner', 'Executioner', '🪓', '+25% damage against bosses and guardians.', 1, 'notable', { bossDmg: 0.25 }, { row: 1, req: ['c_fury'] }),
  C(5, -1, 'c_bulwark', 'Unbreakable', '🗿', 'Keystone (pick one): +100% HP and +15% block, but −30% attack speed.', 1, 'keystone', { hp: 1, block: 0.15, speed: -0.3 }, { group: 'c_path', req: ['c_medic'] }),
  C(5, 0, 'c_legend', 'Living Legends', '👑', '+20% damage, +20% HP, +3% critical chance.', 1, 'notable', { dmg: 0.2, hp: 0.2, crit: 0.03 }, { req: ['c_precision'] }),
  C(5, 1, 'c_glass', 'Glass Cannon', '🔮', 'Keystone (pick one): +100% damage, −50% HP.', 1, 'keystone', { dmg: 1, hp: -0.5 }, { group: 'c_path', req: ['c_executioner'] }),

  // ---------------------------------------------------------------- Digging
  D(0, -1, 'd_arms', 'Strong Arms', '💪', '+5% digging per rank.', 5, 'small', { dig: 0.05 }),
  D(0, 0, 'd_lamp', 'Lanterns', '🏮', '+3% digging and +3% stone per rank.', 3, 'small', { dig: 0.03, stone: 0.03 }),
  D(0, 1, 'd_sort', 'Rock Sorter', '🪨', '+8% stone per rank.', 5, 'small', { stone: 0.08 }),
  D(1, -1.5, 'd_rhythm', 'Steady Rhythm', '🥁', '+8% digging per rank.', 3, 'small', { dig: 0.08 }, { req: ['d_arms'] }),
  D(1, 0, 'd_vein', 'Vein Sense', '✨', '+8% copper and iron per rank.', 5, 'small', { ore: 0.08 }, { req: ['d_arms', 'd_lamp', 'd_sort'] }),
  D(1, 1.5, 'd_crates', 'Packed Crates', '📦', '+10% storage per rank.', 5, 'small', { storage: 0.1 }, { req: ['d_sort'] }),
  D(1, -0.75, 'd_carts', 'Mine Carts', '🛒', '+3% digging and +5% stone per rank.', 3, 'small', { dig: 0.03, stone: 0.05 }, { row: 1, req: ['d_rhythm', 'd_vein'] }),
  D(1, 0.75, 'd_geology', 'Geology', '🔬', '+5% copper and iron per rank.', 3, 'small', { ore: 0.05 }, { row: 1, req: ['d_vein'] }),
  D(2, -1.5, 'd_delver', 'Deep Delver', '🕳️', '+25% digging.', 1, 'notable', { dig: 0.25 }, { req: ['d_rhythm', 'd_carts'] }),
  D(2, -0.5, 'd_precise', 'Precise Picks', '📐', 'Choice: +25% digging, −15% stone.', 1, 'choice', { dig: 0.25, stone: -0.15 }, { group: 'swing', req: ['d_vein', 'd_carts', 'd_geology'] }),
  D(2, 0.5, 'd_wide', 'Wide Swings', '🌀', 'Choice: +30% stone and ore, −10% digging.', 1, 'choice', { stone: 0.3, ore: 0.3, dig: -0.1 }, { group: 'swing', req: ['d_vein', 'd_carts', 'd_geology'] }),
  D(2, 1.5, 'd_hoard', 'Hoarder', '🏺', '+50% storage.', 1, 'notable', { storage: 0.5 }, { req: ['d_crates', 'd_geology'] }),
  D(2, -1.5, 'd_shoring', 'Shoring Beams', '🪵', '+5% digging per rank.', 5, 'small', { dig: 0.05 }, { row: 1, req: ['d_delver'] }),
  D(2, 1.5, 'd_smelt', 'Field Smelting', '🔥', 'Gear costs 5% less per rank.', 3, 'small', { gearCost: 0.05 }, { row: 1, req: ['d_hoard'] }),
  D(3, -1, 'd_drill', 'Steam Drill', '🚂', '+20% digging.', 1, 'notable', { dig: 0.2 }, { req: ['d_shoring', 'd_precise'] }),
  D(3, 0, 'd_seismic', 'Seismic Sense', '📡', '+4% digging and +4% ore per rank.', 5, 'small', { dig: 0.04, ore: 0.04 }, { req: ['d_precise', 'd_wide'] }),
  D(3, 1, 'd_motherlode', 'Motherlode', '💎', '+30% copper and iron.', 1, 'notable', { ore: 0.3 }, { req: ['d_smelt', 'd_wide'] }),
  D(4, -1, 'd_deepcore', 'Deep Core', '🌋', '+6% digging per rank.', 5, 'small', { dig: 0.06 }, { req: ['d_drill'] }),
  D(4, 0, 'd_rubble', 'Rubble Recycling', '♻️', '+8% stone per rank.', 5, 'small', { stone: 0.08 }, { req: ['d_seismic'] }),
  D(4, 1, 'd_vault', 'Vaults', '🏦', '+15% storage per rank.', 5, 'small', { storage: 0.15 }, { req: ['d_motherlode'] }),
  D(4, 0, 'd_gemcut', 'Gem Cutters', '💍', '+10% gold per rank.', 3, 'small', { gold: 0.1 }, { row: 1, req: ['d_rubble'] }),
  D(5, -1, 'd_tunnel', 'Tunnel Vision', '🔦', 'Keystone (pick one): +60% digging, −40% stone and ore.', 1, 'keystone', { dig: 0.6, stone: -0.4, ore: -0.4 }, { group: 'd_path', req: ['d_deepcore'] }),
  D(5, 0, 'd_earthshaper', 'Earthshaper', '🌍', '+25% digging and +25% stone.', 1, 'notable', { dig: 0.25, stone: 0.25 }, { req: ['d_gemcut'] }),
  D(5, 1, 'd_prospector', 'Prospector', '⛏️', 'Keystone (pick one): +100% copper and iron, −30% digging.', 1, 'keystone', { ore: 1, dig: -0.3 }, { group: 'd_path', req: ['d_vault'] }),

  // ---------------------------------------------------------------- Colony
  O(0, -1, 'o_green', 'Green Thumbs', '🍄', '+6% mushrooms per rank.', 5, 'small', { food: 0.06 }),
  O(0, 0, 'o_hearth', 'Hearths', '🔥', '+4% colony growth per rank.', 3, 'small', { growth: 0.04 }),
  O(0, 1, 'o_beds', 'Cozy Beds', '🛏️', '+1 max colonist per rank.', 5, 'small', { pop: 1 }),
  O(1, -1.5, 'o_pockets', 'Shiny Pockets', '🪙', '+6% gold per rank.', 5, 'small', { gold: 0.06 }, { req: ['o_green'] }),
  O(1, 0, 'o_thrift', 'Thrifty Builders', '🔨', 'Floors cost 4% less per rank.', 5, 'small', { floorCost: 0.04 }, { req: ['o_green', 'o_hearth', 'o_beds'] }),
  O(1, 1.5, 'o_family', 'Big Families', '👪', '+8% colony growth per rank.', 5, 'small', { growth: 0.08 }, { req: ['o_beds'] }),
  O(1, -0.75, 'o_pantry', 'Pantry', '🥫', 'Dwarves eat 4% less per rank.', 5, 'small', { eat: 0.04 }, { row: 1, req: ['o_green', 'o_pockets'] }),
  O(1, 0.75, 'o_midwife', 'Midwives', '🍼', 'New dwarves cost 10% fewer mushrooms per rank.', 3, 'small', { birthCost: 0.1 }, { row: 1, req: ['o_family', 'o_hearth'] }),
  O(2, -1, 'o_feast', 'Feast Days', '🍲', 'Choice: +30% mushrooms, −10% growth.', 1, 'choice', { food: 0.3, growth: -0.1 }, { group: 'society', req: ['o_pantry', 'o_thrift'] }),
  O(2, 0, 'o_book', 'Bookish', '📚', '+10% knowledge per rank.', 3, 'small', { know: 0.1 }, { req: ['o_thrift'] }),
  O(2, 1, 'o_crowd', 'Crowded Halls', '🏘️', 'Choice: +5 max colonists, −10% mushrooms.', 1, 'choice', { pop: 5, food: -0.1 }, { group: 'society', req: ['o_midwife', 'o_thrift'] }),
  O(2, -1.5, 'o_market', 'Market Day', '🏪', '+10% gold per rank.', 3, 'small', { gold: 0.1 }, { row: 1, req: ['o_feast', 'o_pockets'] }),
  O(2, 0, 'o_scribes', 'Scribes', '✒️', 'Research costs 5% less per rank.', 5, 'small', { researchCost: 0.05 }, { row: 1, req: ['o_book'] }),
  O(2, 1.5, 'o_architect', 'Architects', '📏', 'Floors cost 5% less per rank.', 3, 'small', { floorCost: 0.05 }, { row: 1, req: ['o_crowd', 'o_family'] }),
  O(3, -1, 'o_brewers', 'Brewmasters', '🍺', '+6% colony growth per rank.', 5, 'small', { growth: 0.06 }, { req: ['o_market'] }),
  O(3, 0, 'o_townhall', 'Town Hall', '🏛️', '+10% mushrooms, growth and knowledge.', 1, 'notable', { food: 0.1, growth: 0.1, know: 0.1 }, { req: ['o_scribes'] }),
  O(3, 1, 'o_masons', 'Master Masons', '🧱', 'Floors cost 4% less per rank.', 5, 'small', { floorCost: 0.04 }, { req: ['o_architect'] }),
  O(4, -1, 'o_granary', 'Granaries', '🌾', '+8% mushrooms per rank.', 5, 'small', { food: 0.08 }, { req: ['o_brewers'] }),
  O(4, 0, 'o_devotion', 'Devotion', '🙏', '+5% Divine Favor per rank.', 5, 'small', { favor: 0.05 }, { req: ['o_townhall'] }),
  O(4, 1, 'o_housing', 'Stacked Housing', '🏢', '+2 max colonists per rank.', 5, 'small', { pop: 2 }, { req: ['o_masons'] }),
  O(4, 0, 'o_census', 'Census', '📊', '+4% output from all jobs per rank.', 3, 'small', { jobs: 0.04 }, { row: 1, req: ['o_devotion'] }),
  O(5, -1, 'o_utopia', 'Mushroom Utopia', '🌈', 'Keystone (pick one): +50% growth and mushrooms, −20% digging.', 1, 'keystone', { growth: 0.5, food: 0.5, dig: -0.2 }, { group: 'o_path', req: ['o_granary'] }),
  O(5, 0, 'o_golden', 'Golden Age', '🌟', '+25% gold and +15% Divine Favor.', 1, 'notable', { gold: 0.25, favor: 0.15 }, { req: ['o_census'] }),
  O(5, 1, 'o_empire', 'Mountain Empire', '🏔️', 'Keystone (pick one): +25 max colonists, −25% growth.', 1, 'keystone', { pop: 25, growth: -0.25 }, { group: 'o_path', req: ['o_housing'] }),

  // ---------------------------------------------------------------- Hands-On
  H(0, -1, 'h_knuckle', 'Divine Knuckles', '👊', '+10% tap power per rank.', 5, 'small', { tap: 0.1 }),
  H(0, 0, 'h_focus', 'Focus', '🧘', '+10% stone from taps per rank.', 3, 'small', { tapStone: 0.1 }),
  H(0, 1, 'h_patience', 'Patience', '⏳', 'Combo lasts 0.1s longer between taps, per rank.', 5, 'small', { comboWindow: 100 }),
  H(1, -1.5, 'h_rubble', 'Rubble Rouser', '🧱', '+25% stone from taps per rank.', 3, 'small', { tapStone: 0.25 }, { req: ['h_knuckle'] }),
  H(1, 0, 'h_practice', 'Practice', '📈', '+5% XP in every skill per rank.', 3, 'small', { xp: 0.05 }, { req: ['h_knuckle', 'h_focus', 'h_patience'] }),
  H(1, 1.5, 'h_artist', 'Combo Artist', '🎨', '+5% maximum combo bonus per rank.', 5, 'small', { combo: 0.05 }, { req: ['h_patience'] }),
  H(1, -0.75, 'h_lucky', 'Lucky Taps', '🍀', '+2% chance for a tap to crit (×3 power) per rank.', 5, 'small', { tapCrit: 0.02 }, { row: 1, req: ['h_knuckle', 'h_practice'] }),
  H(1, 0.75, 'h_tempo', 'Tempo', '🎼', 'Combo lasts 0.15s longer between taps, per rank.', 3, 'small', { comboWindow: 150 }, { row: 1, req: ['h_artist', 'h_practice'] }),
  H(2, -1, 'h_frenzy', 'Frenzy', '🔥', '+30% tap power.', 1, 'notable', { tap: 0.3 }, { req: ['h_rubble', 'h_lucky'] }),
  H(2, 0, 'h_crushing', 'Crushing Blow', '🔨', 'Tap crits hit 50% harder per rank.', 3, 'small', { tapCritDmg: 0.5 }, { req: ['h_lucky'] }),
  H(2, 1, 'h_flow', 'Flow State', '🌊', '+20% maximum combo bonus and combo lasts 0.5s longer.', 1, 'notable', { combo: 0.2, comboWindow: 500 }, { req: ['h_tempo', 'h_artist'] }),
  H(2, -1, 'h_quarry', 'Quarryman', '⛰️', '+15% stone from taps per rank.', 5, 'small', { tapStone: 0.15 }, { row: 1, req: ['h_frenzy'] }),
  H(2, 1, 'h_drums', 'Drum Circle', '🪘', '+8% tap power per rank.', 5, 'small', { tap: 0.08 }, { row: 1, req: ['h_flow'] }),
  H(3, -1, 'h_jackpot', 'Jackpot', '🎰', '+2% tap crit chance per rank.', 5, 'small', { tapCrit: 0.02 }, { req: ['h_quarry', 'h_crushing'] }),
  H(3, 0, 'h_inspire', 'Inspiring Presence', '✨', 'Your enthusiasm rubs off: +10% output from all jobs.', 1, 'notable', { jobs: 0.1 }, { req: ['h_crushing'] }),
  H(3, 1, 'h_marathon', 'Marathon', '🏃', '+5% maximum combo bonus per rank.', 5, 'small', { combo: 0.05 }, { req: ['h_drums', 'h_crushing'] }),
  H(4, -1, 'h_learning', 'Hands-On Learning', '🎓', '+4% XP in every skill per rank.', 5, 'small', { xp: 0.04 }, { req: ['h_jackpot'] }),
  H(4, 0, 'h_aftershock', 'Aftershock', '🌋', '+6% tap power per rank.', 5, 'small', { tap: 0.06 }, { req: ['h_inspire'] }),
  H(4, 1, 'h_sync', 'In Sync', '🔗', 'Combo lasts 0.1s longer between taps, per rank.', 5, 'small', { comboWindow: 100 }, { req: ['h_marathon'] }),
  H(5, -1, 'h_god', 'Hand of God', '✋', 'Keystone (pick one): +200% tap power, −30% output from all jobs.', 1, 'keystone', { tap: 2, jobs: -0.3 }, { group: 'h_path', req: ['h_learning'] }),
  H(5, 0, 'h_master', 'Grandmaster', '🥋', '+25% tap power and +10% XP in every skill.', 1, 'notable', { tap: 0.25, xp: 0.1 }, { req: ['h_aftershock'] }),
  H(5, 1, 'h_thousand', 'Thousand Hands', '🙌', 'Keystone (pick one): +100% maximum combo bonus, but the combo window is 0.5s shorter.', 1, 'keystone', { combo: 1, comboWindow: -500 }, { group: 'h_path', req: ['h_sync'] }),

  // ---------------------------------------------------------------- Hands-Off
  F(0, -1, 'f_night', 'Night Shift', '🌜', '+1 hour of offline progress per rank.', 5, 'small', { offline: 1 }),
  F(0, 0, 'f_calm', 'Quiet Halls', '🤫', '+5% job output while you leave the colony alone, per rank.', 3, 'small', { idleJobs: 0.05 }),
  F(0, 1, 'f_clock', 'Clockwork', '⚙️', '+4% output from all jobs per rank.', 5, 'small', { jobs: 0.04 }),
  F(1, -1.5, 'f_dream', 'Dream Learning', '💤', '+20% offline XP per rank.', 3, 'small', { offlineXp: 0.2 }, { req: ['f_night'] }),
  F(1, 0, 'f_drill', 'Drill Instructor', '🎺', 'Your equipped abilities can cast themselves.', 1, 'notable', { autoCast: 1 }, { req: ['f_night', 'f_calm', 'f_clock'] }),
  F(1, 1.5, 'f_bell', 'Muster Bell', '🔔', 'Squads regroup 10% faster per rank.', 3, 'small', { regroup: 0.1 }, { req: ['f_clock'] }),
  F(1, -0.75, 'f_routine', 'Routines', '📅', '+5% job output while you leave the colony alone, per rank.', 5, 'small', { idleJobs: 0.05 }, { row: 1, req: ['f_calm', 'f_dream'] }),
  F(1, 0.75, 'f_logistics', 'Logistics', '🚚', '+10% storage per rank.', 3, 'small', { storage: 0.1 }, { row: 1, req: ['f_clock', 'f_bell'] }),
  F(2, -1, 'f_quarter', 'Quartermaster', '🎒', '+1 ability slot.', 1, 'notable', { slots: 1 }, { req: ['f_drill'] }),
  F(2, 0, 'f_ledger', 'Ledgers', '📒', '+8% gold per rank.', 5, 'small', { gold: 0.08 }, { req: ['f_routine', 'f_logistics'] }),
  F(2, 1, 'f_foreman', 'Foreman', '📋', '+15% output from all jobs.', 1, 'notable', { jobs: 0.15 }, { req: ['f_drill', 'f_bell'] }),
  F(2, -1, 'f_nightowl', 'Night Owl', '🦉', '+2 hours of offline progress per rank.', 3, 'small', { offline: 2 }, { row: 1, req: ['f_quarter', 'f_dream'] }),
  F(2, 1, 'f_overseer', 'Overseers', '👁️', '+5% output from all jobs per rank.', 5, 'small', { jobs: 0.05 }, { row: 1, req: ['f_foreman'] }),
  F(3, -1, 'f_sleep', 'Deep Sleep', '😴', '+15% offline XP per rank.', 5, 'small', { offlineXp: 0.15 }, { req: ['f_nightowl'] }),
  F(3, 0, 'f_helpers', 'Clockwork Helpers', '🤖', '+10% output from all jobs, +10% more while you leave the colony alone.', 1, 'notable', { jobs: 0.1, idleJobs: 0.1 }, { req: ['f_ledger'] }),
  F(3, 1, 'f_reserves', 'Reserves', '🪖', '+1 squad size per rank.', 3, 'small', { squadCap: 1 }, { req: ['f_overseer'] }),
  F(4, -1, 'f_lucid', 'Lucid Dreamers', '🌌', '+4% XP in every skill per rank.', 5, 'small', { xp: 0.04 }, { req: ['f_sleep'] }),
  F(4, 0, 'f_steady', 'Steady State', '⚖️', '+6% job output while you leave the colony alone, per rank.', 5, 'small', { idleJobs: 0.06 }, { req: ['f_helpers'] }),
  F(4, 1, 'f_supply', 'Supply Lines', '📦', 'Squads regroup 8% faster per rank.', 5, 'small', { regroup: 0.08 }, { req: ['f_reserves'] }),
  F(5, -1, 'f_autopilot', 'Autopilot', '🛸', 'Keystone (pick one): +50% output from all jobs, −50% tap power.', 1, 'keystone', { jobs: 0.5, tap: -0.5 }, { group: 'f_path', req: ['f_lucid', 'f_steady'] }),
  F(5, 0, 'f_eternal', 'Eternal Engine', '♾️', '+20% output from all jobs, +20% more while you leave the colony alone.', 1, 'notable', { jobs: 0.2, idleJobs: 0.2 }, { req: ['f_steady'] }),
  F(5, 1, 'f_hibernate', 'Hibernation', '🐻', 'Keystone (pick one): +12 hours offline and +50% offline XP, −15% output from all jobs.', 1, 'keystone', { offline: 12, offlineXp: 0.5, jobs: -0.15 }, { group: 'f_path', req: ['f_supply', 'f_steady'] }),
];
export const NODE_BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]));

/** Ranks needed to fully master a tree (choice groups count once). Level 99 grants exactly this many points. */
export const TREE_MAX: Record<SkillId, number> = Object.fromEntries(SKILL_IDS.map((t) => {
  const nodes = NODES.filter((n) => n.tree === t);
  let total = nodes.filter((n) => !n.group).reduce((a, n) => a + n.max, 0);
  for (const g of new Set(nodes.map((n) => n.group).filter(Boolean))) {
    total += Math.max(...nodes.filter((n) => n.group === g).map((n) => n.max));
  }
  return [t, total];
})) as Record<SkillId, number>;

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
export const IDLE_AFTER = 30_000; // ms without tapping before "leave the colony alone" bonuses kick in
export const TAP_CRIT_MULT = 3;
