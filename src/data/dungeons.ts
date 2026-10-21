// Dungeons: Hidden Caverns found while digging. Explore them room by room with your squad for loot and Heirlooms.

export const DUNGEON = {
  unlockGuardian: 1, // dungeons open once this guardian (Sir Stonejaw) has ever been defeated
  findFrom: 10, // caverns can be found from this depth...
  findChance: 0.06, // ...with this chance per level dug
  maxCaverns: 3, // caverns you can hold at once (finding more while full does nothing)
  rooms: 6, // rooms before the boss
  doors: 3, // doors to choose from in each room
  // Each fight costs this share of the party's max HP (×0.6–1.4 at random, less with Fighters' block).
  // Fights scale with your party, so caverns are about choosing doors well, not raw power.
  cost: { monster: 0.14, elite: 0.3, boss: 0.6 },
  goldPerKill: 6, // gold per fight, × gold scaling at your best zone (×10 for the boss, ×3 for elites)
  treasureGold: 12,
  fountainHeal: 0.5, // share of max HP restored
  trapDamage: 0.25, // share of max HP lost
};

export type RoomId = 'monster' | 'elite' | 'treasure' | 'fountain' | 'mystery';
export const ROOMS: Record<RoomId, { name: string; icon: string; desc: string; weight: number }> = {
  monster: { name: 'Monster Den', icon: '⚔️', desc: 'A fight. Gold and a little XP.', weight: 4 },
  elite: { name: 'Elite Lair', icon: '☠️', desc: 'A tough fight. Better loot, better Heirloom odds.', weight: 1.5 },
  treasure: { name: 'Treasure Room', icon: '💰', desc: 'Gold, and a chance at an Heirloom.', weight: 2 },
  fountain: { name: 'Fountain', icon: '⛲', desc: `Restores ${50}% of your party's HP.`, weight: 1.5 },
  mystery: { name: 'Mystery Door', icon: '❓', desc: 'Could be anything. Probably fine.', weight: 2 },
};
export const ROOM_IDS = Object.keys(ROOMS) as RoomId[];

/** Names for the cavern's boss, picked by how deep the cavern was found. */
export const CAVERN_BOSSES: { from: number; name: string; sprite: string; pal: Record<string, string> }[] = [
  { from: 0, name: 'The Mushroom Baron', sprite: 'shroom', pal: { r: '#df7126' } },
  { from: 25, name: 'Skeleton Middle-Manager', sprite: 'skeleton', pal: {} },
  { from: 45, name: 'A Very Large Mimic', sprite: 'mimic', pal: {} },
  { from: 70, name: 'The Owlbear Matriarch', sprite: 'owlbear', pal: {} },
  { from: 100, name: 'Beholder (Certified)', sprite: 'eye', pal: {} },
  { from: 140, name: 'The Drowned Bard', sprite: 'wraith', pal: { l: '#5fcde4' } },
  { from: 180, name: 'Bone Dragon (Small)', sprite: 'wyrm', pal: { g: '#f3ead8', G: '#b0a08f' } },
];
