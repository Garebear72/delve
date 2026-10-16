// Loading, saving and offline catch-up for the active save slot.
import { RES_IDS, ResId } from '../data/defs';
import { div } from './calc';
import { setQuiet, toast } from './events';
import { loadSlot, saveSlot, setActiveSlot } from './save';
import { catchUp } from './sim';
import { GameState, newGame } from './state';
import { refresh, store } from './store';

export interface OfflineReport {
  away: number;
  simulated: number;
  res: Partial<Record<ResId, number>>;
  depth: number;
  zones: number;
  kills: number;
  pop: number;
}

export function saveNow(): boolean {
  const ok = saveSlot(store.slot, store.state);
  if (!ok) toast('Could not save! Your browser storage may be full or blocked.', 'bad');
  return ok;
}

export function offlineCap(s: GameState) {
  return (8 + 4 * div(s, 'memory')) * 3600;
}

export function applyOffline(seconds: number): OfflineReport {
  const s = store.state;
  const sim = Math.min(seconds, offlineCap(s));
  const before = { res: { ...s.run.res }, depth: s.run.depth, zone: s.run.maxZone, kills: s.meta.lifetime.kills ?? 0, pop: s.run.pop };
  setQuiet(true);
  try { catchUp(s, sim); } finally { setQuiet(false); }
  refresh();
  const res: Partial<Record<ResId, number>> = {};
  for (const k of RES_IDS) {
    const diff = s.run.res[k] - before.res[k];
    if (Math.abs(diff) >= 1) res[k] = diff;
  }
  return {
    away: seconds, simulated: sim, res,
    depth: s.run.depth - before.depth, zones: s.run.maxZone - before.zone,
    kills: (s.meta.lifetime.kills ?? 0) - before.kills, pop: s.run.pop - before.pop,
  };
}

/** Switch to a slot (creating a new game if empty). Returns an offline report if time passed. */
export function openSlot(id: number): OfflineReport | null {
  const loaded = loadSlot(id);
  store.state = loaded ?? newGame();
  store.slot = id;
  setActiveSlot(id);
  refresh();
  if (!loaded) { saveNow(); return null; }
  const away = (Date.now() - store.state.savedAt) / 1000;
  return away > 10 ? applyOffline(away) : null;
}

export function replaceState(s: GameState) {
  store.state = s;
  refresh();
  saveNow();
}
