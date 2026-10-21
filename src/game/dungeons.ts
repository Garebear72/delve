// Dungeons: Hidden Caverns found while digging, explored room by room with a party as strong as your squad.
import { BOSS_RELICS, RELICS } from '../data/defs';
import { CAVERN_BOSSES, DUNGEON, RoomId, ROOMS, ROOM_IDS } from '../data/dungeons';
import { XP } from '../data/skills';
import { goldMult, squadStats } from './calc';
import { emit, toast } from './events';
import { baseLuck, rollCurio } from './minigames';
import { addXp } from './skills';
import type { DungeonState, GameState } from './state';

const lifetime = (s: GameState, key: string, n: number) => { s.meta.lifetime[key] = (s.meta.lifetime[key] ?? 0) + n; };

/** Dungeons open once Sir Stonejaw has ever been defeated. */
export const dungeonsOpen = (s: GameState) => (s.meta.bestiary['g' + DUNGEON.unlockGuardian] ?? 0) > 0;
// Rewards scale with your all-time best Expedition zone.
const zoneOf = (s: GameState) => Math.max(1, s.run.maxZone, s.meta.bestZone);
const goldScale = (s: GameState) => Math.pow(1.25, zoneOf(s) - 1) * goldMult(s);
export const cavernBoss = (depth: number) => CAVERN_BOSSES.filter((b) => b.from <= depth).pop()!;

/** Called for every level dug: sometimes the miners break into a Hidden Cavern. */
export function maybeFindCavern(s: GameState, level: number) {
  const r = s.run;
  if (!dungeonsOpen(s) || level < DUNGEON.findFrom || r.caverns.length >= DUNGEON.maxCaverns) return;
  if (Math.random() >= DUNGEON.findChance) return;
  r.caverns.push(level);
  lifetime(s, 'caverns', 1);
  toast(`🕳️ Your miners broke into a Hidden Cavern at depth ${level}! Explore it from the Battle tab.`, 'epic');
  emit('cavern', level);
}

function rollDoors(): RoomId[] {
  const total = ROOM_IDS.reduce((a, id) => a + ROOMS[id].weight, 0);
  const pick = () => {
    let x = Math.random() * total;
    for (const id of ROOM_IDS) { x -= ROOMS[id].weight; if (x < 0) return id; }
    return ROOM_IDS[0];
  };
  return Array.from({ length: DUNGEON.doors }, pick);
}

/** The party is your squad plan, at full strength (it doesn't use up colonists). */
export const partyStats = (s: GameState) => squadStats(s, s.run.combat.plan);
export const canExplore = (s: GameState) => partyStats(s).size > 0 && !s.run.dungeon;

export function enterCavern(s: GameState, idx: number): boolean {
  const r = s.run;
  if (idx < 0 || idx >= r.caverns.length || !canExplore(s)) return false;
  const depth = r.caverns.splice(idx, 1)[0];
  const p = partyStats(s);
  r.dungeon = {
    depth, room: 0, hp: p.maxHp, maxHp: p.maxHp, doors: rollDoors(), gold: 0, found: [],
    log: [`Your party squeezes into the cavern at depth ${depth}. It smells of old socks and adventure.`], over: '',
  };
  lifetime(s, 'dungeons.entered', 1);
  return true;
}

/** Resolve a fight: it costs a random share of the party's max HP (Fighters' block softens it). */
function fight(s: GameState, dg: DungeonState, kind: 'monster' | 'elite' | 'boss'): boolean {
  const p = partyStats(s);
  const dmg = dg.maxHp * DUNGEON.cost[kind] * (0.6 + Math.random() * 0.8) * (1 - p.block * 0.5);
  if (dmg >= dg.hp) { dg.hp = 0; return false; }
  dg.hp -= dmg;
  addXp(s, 'combat', XP.killBase * Math.pow(zoneOf(s), 1.1) * (kind === 'boss' ? 10 : kind === 'elite' ? 3 : 1));
  return true;
}

function addGold(s: GameState, dg: DungeonState, amount: number) {
  dg.gold += amount;
  s.run.res.gold += amount;
  lifetime(s, 'res.gold', amount);
}

function heirloom(s: GameState, dg: DungeonState, luck: number) {
  const id = rollCurio(s, 'dungeon', luck * baseLuck(s));
  if (id) dg.found.push(id);
}

/** Open one of the doors in the current room (or the boss door at the end). */
export function chooseDoor(s: GameState, i: number): boolean {
  const dg = s.run.dungeon;
  if (!dg || dg.over) return false;
  const bossRoom = dg.room >= DUNGEON.rooms;
  const kind = (bossRoom ? 'boss' : dg.doors[i]) as RoomId | 'boss' | undefined;
  if (!kind) return false;
  const say = (t: string) => { dg.log.unshift(t); dg.log.length = Math.min(dg.log.length, 6); };
  const g = goldScale(s);

  if (kind === 'monster' || kind === 'elite') {
    const elite = kind === 'elite';
    const won = fight(s, dg, kind);
    if (!won) return defeat(s, dg, elite ? 'The elite was too much. Your party limps home.' : 'The monsters drive your party out.');
    const gold = DUNGEON.goldPerKill * g * (elite ? 3 : 1);
    addGold(s, dg, gold);
    say(elite ? `☠️ You beat an elite! +${Math.floor(gold)} gold.` : `⚔️ You clear the den. +${Math.floor(gold)} gold.`);
    if (elite) heirloom(s, dg, 2);
  } else if (kind === 'treasure') {
    const gold = DUNGEON.treasureGold * g;
    addGold(s, dg, gold);
    say(`💰 A treasure pile! +${Math.floor(gold)} gold.`);
    heirloom(s, dg, 1);
  } else if (kind === 'fountain') {
    const heal = Math.min(dg.maxHp - dg.hp, dg.maxHp * DUNGEON.fountainHeal);
    dg.hp += heal;
    say(`⛲ A glowing fountain. Your party feels better (+${Math.floor(heal)} HP).`);
  } else if (kind === 'mystery') {
    const x = Math.random();
    if (x < 0.35) { const gold = DUNGEON.treasureGold * 2 * g; addGold(s, dg, gold); say(`❓ A hidden stash! +${Math.floor(gold)} gold.`); }
    else if (x < 0.6) {
      dg.hp -= dg.maxHp * DUNGEON.trapDamage;
      say('❓ A trap! Darts, mostly. Your party is hurt.');
      if (dg.hp <= 0) return defeat(s, dg, 'The trap was nastier than it looked. Your party retreats.');
    } else if (x < 0.8) { dg.hp = dg.maxHp; say('❓ A friendly ghost patches everyone up. Full HP!'); }
    else { say('❓ Something glints in the dark...'); heirloom(s, dg, 3); }
  } else {
    const won = fight(s, dg, 'boss');
    const boss = cavernBoss(dg.depth);
    if (!won) return defeat(s, dg, `${boss.name} sends your party packing. You keep what you found.`);
    const gold = DUNGEON.goldPerKill * 10 * g;
    addGold(s, dg, gold);
    say(`👑 ${boss.name} is defeated! +${Math.floor(gold)} gold.`);
    heirloom(s, dg, 4); heirloom(s, dg, 4);
    if (Math.random() < 0.15) {
      const missing = BOSS_RELICS.filter((x) => !s.run.relics.includes(x));
      if (missing.length) {
        const id = missing[Math.floor(Math.random() * missing.length)];
        s.run.relics.push(id);
        if (!s.meta.relicsFound.includes(id)) s.meta.relicsFound.push(id);
        say(`✨ Relic found: ${RELICS[id].name}!`);
        toast(`Relic found: ${RELICS[id].name}! ${RELICS[id].desc}`, 'epic');
      }
    }
    dg.over = 'won';
    lifetime(s, 'dungeons.cleared', 1);
    toast(`Cavern cleared! +${Math.floor(dg.gold)} gold in total.`, 'epic');
    emit('dungeon', 'won');
    return true;
  }
  dg.room++;
  dg.doors = dg.room >= DUNGEON.rooms ? [] : rollDoors();
  emit('dungeon', kind);
  return true;
}

function defeat(s: GameState, dg: DungeonState, text: string) {
  dg.hp = 0;
  dg.over = 'fled';
  dg.log.unshift(`💀 ${text}`);
  emit('dungeon', 'fled');
  return true;
}

/** Leave: retreat with what you found, or close a finished dungeon. */
export function leaveDungeon(s: GameState) {
  const dg = s.run.dungeon;
  if (!dg) return false;
  if (!dg.over) toast(`Your party heads home with ${Math.floor(dg.gold)} gold.`, 'good');
  s.run.dungeon = null;
  return true;
}
