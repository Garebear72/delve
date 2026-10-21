// Cloud saves wired into the game: which save is "local", how a cloud save is applied, when to sync.
import { onInput } from '../game/input';
import { loadSlot, saveSlot } from '../game/save';
import { applyOffline, OfflineReport, saveNow } from '../game/session';
import { GameState, migrate } from '../game/state';
import { refresh, store } from '../game/store';
import { SupabaseBackend } from './backend';
import { cloudConfigured } from './config';
import { MemoryBackend, MemoryServer } from './memory';
import { CloudSave, CloudSync, LocalSave } from './sync';

export const deviceName = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'Phone' : 'PC';

/** A save worth protecting: anything beyond the first minute of a brand-new game. */
const hasProgress = (s: GameState) => s.meta.time >= 60 || s.run.depth > 0 || s.meta.prestiges > 0;
const summary = (s: GameState) => `Depth ${s.run.depth} · Zone ${s.run.maxZone} · ${s.meta.prestiges} prestiges`;

export interface CloudUI {
  ask(local: LocalSave, cloud: CloudSave): Promise<'local' | 'cloud'>;
  loaded(cloud: CloudSave, report: OfflineReport | null): void;
}
let ui: CloudUI | null = null;
export const cloudStatus = { text: 'Not signed in', kind: 'off' as 'ok' | 'busy' | 'error' | 'off', lastSync: 0 };

// Dev only: `?fakecloud` uses an in-memory server (window.fakeServer) to test the cloud UI without Supabase.
const fake = import.meta.env.DEV && location.search.includes('fakecloud') ? new MemoryServer() : null;
if (fake) (window as any).fakeServer = fake;
const backend = cloudConfigured() ? new SupabaseBackend() : fake ? new MemoryBackend(fake) : null;
export const cloud = backend ? new CloudSync(backend, {
  get: (k) => { try { return localStorage.getItem('delve.' + k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem('delve.' + k, v); } catch { /* ignore */ } },
}, {
  deviceName,
  local(slot) {
    if (slot === store.slot) saveNow();
    const s = slot === store.slot ? store.state : loadSlot(slot);
    return s ? { exists: hasProgress(s), data: JSON.stringify(s), savedAt: s.savedAt, summary: summary(s) }
      : { exists: false, data: '', savedAt: 0, summary: 'Empty' };
  },
  apply(slot, save) {
    const s = migrate(JSON.parse(save.data));
    if (slot !== store.slot) { saveSlot(slot, s); return; }
    // Load it, then catch up on the time since it was saved (the other device's idle progress).
    const away = Math.max(0, (Date.now() - s.savedAt) / 1000);
    store.state = s;
    refresh();
    const report = away > 60 ? applyOffline(away) : null;
    saveNow();
    ui?.loaded(save, report);
  },
  ask: (_slot, local, c) => ui ? ui.ask(local, c) : Promise.resolve('cloud'),
  status(text, kind) {
    cloudStatus.text = text; cloudStatus.kind = kind;
    if (kind === 'ok') cloudStatus.lastSync = Date.now();
  },
}) : null;

export const cloudBackend = backend;

const SYNC_EVERY = 30_000; // ms between automatic uploads while you play

/** Start cloud sync (after the save slot has loaded). Safe to call when cloud saves aren't configured. */
export async function startCloud(cloudUi: CloudUI) {
  ui = cloudUi;
  if (!cloud) return;
  onInput(() => cloud.markDirty(store.slot));
  await cloud.init();
  if (cloud.user) await cloud.sync(store.slot);
  setInterval(() => {
    if (cloud.user && !cloud.asking && !document.hidden && cloud.record(store.slot).dirty) cloud.sync(store.slot);
  }, SYNC_EVERY);
  document.addEventListener('visibilitychange', () => {
    // Leaving: upload what you did. Coming back: check whether another device played meanwhile.
    if (cloud.user && !cloud.asking && (!document.hidden || cloud.record(store.slot).dirty)) cloud.sync(store.slot);
  });
}
