// Save slots in localStorage, with a rolling backup per slot and text export/import.
import { GameState, migrate } from './state';

export const MAX_SLOTS = 5;
const PREFIX = 'delve.';
const metaKey = PREFIX + 'slots';
const slotKey = (id: number) => `${PREFIX}slot.${id}`;
const backupKey = (id: number) => `${PREFIX}slot.${id}.bak`;

interface SlotsMeta { active: number; names: Record<string, string> }

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string): boolean {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}
function remove(key: string) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

export function slotsMeta(): SlotsMeta {
  try {
    const m = JSON.parse(read(metaKey) ?? '');
    if (m && typeof m.active === 'number') return { active: m.active, names: m.names ?? {} };
  } catch { /* fall through */ }
  return { active: 1, names: {} };
}
function setSlotsMeta(m: SlotsMeta) { write(metaKey, JSON.stringify(m)); }

export function activeSlot(): number { return slotsMeta().active; }
export function setActiveSlot(id: number) { const m = slotsMeta(); m.active = id; setSlotsMeta(m); }
export function slotName(id: number): string { return slotsMeta().names[id] ?? `Save ${id}`; }
export function renameSlot(id: number, name: string) {
  const m = slotsMeta(); m.names[id] = name.slice(0, 24) || `Save ${id}`; setSlotsMeta(m);
}

export function saveSlot(id: number, s: GameState): boolean {
  s.savedAt = Date.now();
  const prev = read(slotKey(id));
  if (prev) write(backupKey(id), prev);
  return write(slotKey(id), JSON.stringify(s));
}

function parse(json: string | null): GameState | null {
  if (!json) return null;
  try { return migrate(JSON.parse(json)); } catch { return null; }
}
export function loadSlot(id: number): GameState | null { return parse(read(slotKey(id))) ?? parse(read(backupKey(id))); }
export function hasBackup(id: number): boolean { return !!read(backupKey(id)); }
export function loadBackup(id: number): GameState | null { return parse(read(backupKey(id))); }

export function deleteSlot(id: number) {
  remove(slotKey(id)); remove(backupKey(id));
  const m = slotsMeta(); delete m.names[id]; setSlotsMeta(m);
}

export interface SlotInfo { id: number; name: string; exists: boolean; savedAt: number; summary: string }
export function listSlots(): SlotInfo[] {
  const out: SlotInfo[] = [];
  for (let id = 1; id <= MAX_SLOTS; id++) {
    const s = parse(read(slotKey(id)));
    out.push({
      id, name: slotName(id), exists: !!s, savedAt: s?.savedAt ?? 0,
      summary: s ? `Depth ${s.run.depth} · Zone ${s.run.maxZone} · ${s.meta.prestiges} prestiges` : 'Empty',
    });
  }
  return out;
}

// ---------------------------------------------------------------- export / import
const TAG = 'DELVE1:';
export function exportString(s: GameState): string {
  const bytes = new TextEncoder().encode(JSON.stringify(s));
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return TAG + btoa(bin);
}
export function importString(text: string): GameState {
  const t = text.trim();
  const body = t.startsWith(TAG) ? t.slice(TAG.length) : t;
  let json: string;
  if (body.startsWith('{')) json = body;
  else {
    const bin = atob(body.replace(/\s+/g, ''));
    json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  }
  const raw = JSON.parse(json);
  if (!raw || typeof raw !== 'object' || !raw.run || !raw.meta) throw new Error('Not a Delve save');
  return migrate(raw);
}

export function requestPersistence() {
  try { navigator.storage?.persist?.(); } catch { /* ignore */ }
}
