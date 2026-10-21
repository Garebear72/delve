// Cloud save sync: the rules for when to upload, download, or ask — independent of the server and the DOM,
// so it can be tested with a fake backend (tools/sync-test.mjs).
//
// Every cloud save has a revision number (rev). Each device remembers the rev it last synced and whether the
// player has *done anything* since (dirty). Idle progress alone doesn't count: both devices can recreate it
// from the save's timestamp, so opening the game on another device just loads the newer save.
// Uploads say which rev they were based on; the server refuses one based on an old rev (ConflictError),
// so two devices can never silently overwrite each other.

export interface CloudSave { slot: number; rev: number; data: string; savedAt: number; device: string; summary: string }
export class ConflictError extends Error { constructor() { super('conflict'); } }

/** The server. Implemented with Supabase in backend.ts and in memory for tests. */
export interface Backend {
  signUp(user: string, pass: string): Promise<void>;
  signIn(user: string, pass: string): Promise<void>;
  signOut(): Promise<void>;
  /** The signed-in username, or null. */
  currentUser(): Promise<string | null>;
  get(slot: number): Promise<CloudSave | null>;
  /** Store a save if the cloud's rev still equals `expectedRev` (0 = no cloud save yet). Returns the new rev. */
  put(slot: number, data: string, expectedRev: number, device: string, summary: string, savedAt: number): Promise<number>;
}

/** What this device knows about one slot's cloud copy. */
export interface SlotRecord { rev: number; dirty: boolean; syncedAt: number; playedAt: number }
/** `exists` is false for an empty slot *or* a barely-started game, which must never win over a cloud save. */
export interface LocalSave { exists: boolean; data: string; savedAt: number; summary: string }

export type Decision = 'nothing' | 'push' | 'pull' | 'ask' | 'pushOver';

/** The heart of sync: compare this device's slot with the cloud's. */
export function decide(local: LocalSave, rec: SlotRecord, cloud: CloudSave | null, alwaysLatest: boolean): Decision {
  if (!cloud) return local.exists ? 'push' : 'nothing';
  if (!local.exists) return 'pull';
  if (cloud.rev === rec.rev) return rec.dirty ? 'push' : 'nothing';
  // The cloud changed since this device last synced (another device saved, or this device never synced).
  if (!rec.dirty) return 'pull';
  // "Latest" means when the player last actually played here, not when the game last autosaved.
  if (alwaysLatest) return rec.playedAt >= cloud.savedAt ? 'pushOver' : 'pull';
  return 'ask';
}

export interface Hooks {
  /** The local save for a slot (serialised). */
  local(slot: number): LocalSave;
  /** Replace the local slot with the cloud copy (and catch up on time since it was saved). */
  apply(slot: number, save: CloudSave): void;
  /** Both changed: ask which to keep. Resolves 'local' or 'cloud'. */
  ask(slot: number, local: LocalSave, cloud: CloudSave): Promise<'local' | 'cloud'>;
  /** Status line for the UI. */
  status(text: string, kind: 'ok' | 'busy' | 'error' | 'off'): void;
  deviceName: string;
}

/** Per-device sync bookkeeping, persisted through a tiny key-value store (localStorage in the game). */
export interface KV { get(key: string): string | null; set(key: string, value: string): void }

export class CloudSync {
  private busy: Promise<unknown> = Promise.resolve();
  user: string | null = null;
  /** True while the player is being asked which save to keep (automatic syncs wait). */
  asking = false;

  constructor(private backend: Backend, private kv: KV, private hooks: Hooks) {}

  get alwaysLatest() { return this.kv.get('cloud.latest') === '1'; }
  set alwaysLatest(v: boolean) { this.kv.set('cloud.latest', v ? '1' : '0'); }

  record(slot: number): SlotRecord {
    try {
      const r = JSON.parse(this.kv.get(`cloud.slot.${slot}`) ?? '');
      if (r && typeof r.rev === 'number') return { rev: r.rev, dirty: !!r.dirty, syncedAt: r.syncedAt ?? 0, playedAt: r.playedAt ?? 0 };
    } catch { /* fresh */ }
    // Never synced on this device: any existing local game counts as unsynced progress.
    return { rev: 0, dirty: true, syncedAt: 0, playedAt: 0 };
  }
  private setRecord(slot: number, r: SlotRecord) { this.kv.set(`cloud.slot.${slot}`, JSON.stringify(r)); }

  /** The player did something in this slot: it now has progress the cloud doesn't. */
  markDirty(slot: number, now = Date.now()) {
    const r = this.record(slot);
    if (r.dirty && now - r.playedAt < 5000) return; // throttle writes while tapping
    r.dirty = true; r.playedAt = now;
    this.setRecord(slot, r);
  }

  async init() {
    this.user = await this.backend.currentUser().catch(() => null);
    this.hooks.status(this.user ? `Signed in as ${this.user}` : 'Not signed in', this.user ? 'ok' : 'off');
    return this.user;
  }

  async signIn(user: string, pass: string, create: boolean) {
    if (create) await this.backend.signUp(user, pass);
    else await this.backend.signIn(user, pass);
    this.user = await this.backend.currentUser();
    // A different account (or a fresh sign-in) must not reuse old bookkeeping: treat local games as unsynced.
    for (let slot = 1; slot <= 5; slot++) this.setRecord(slot, { rev: 0, dirty: true, syncedAt: 0, playedAt: this.record(slot).playedAt });
  }

  async signOut() {
    await this.backend.signOut();
    this.user = null;
    this.hooks.status('Not signed in', 'off');
  }

  /** Compare one slot with the cloud and do the right thing. Calls are queued so two never overlap. */
  sync(slot: number): Promise<Decision | 'error' | 'off'> {
    const run = this.busy.then(() => this.syncNow(slot), () => this.syncNow(slot));
    this.busy = run.catch(() => undefined);
    return run;
  }

  private async syncNow(slot: number, retry = true): Promise<Decision | 'error' | 'off'> {
    if (!this.user) return 'off';
    this.hooks.status('Syncing…', 'busy');
    try {
      const cloud = await this.backend.get(slot);
      const local = this.hooks.local(slot);
      const rec = this.record(slot);
      let d = decide(local, rec, cloud, this.alwaysLatest);
      if (d === 'ask' && cloud) {
        this.asking = true;
        try { d = (await this.hooks.ask(slot, local, cloud)) === 'local' ? 'pushOver' : 'pull'; } finally { this.asking = false; }
      }
      if (d === 'pull' && cloud) {
        this.hooks.apply(slot, cloud);
        this.setRecord(slot, { rev: cloud.rev, dirty: false, syncedAt: Date.now(), playedAt: rec.playedAt });
      } else if (d === 'push' || d === 'pushOver') {
        const fresh = this.hooks.local(slot); // the ask may have taken a while
        const expected = d === 'pushOver' ? (cloud?.rev ?? 0) : rec.rev;
        const rev = await this.backend.put(slot, fresh.data, expected, this.hooks.deviceName, fresh.summary, fresh.savedAt);
        // If the player kept playing while this upload was in flight, that newer progress is still unsynced.
        const now = this.record(slot);
        this.setRecord(slot, { rev, dirty: now.playedAt > rec.playedAt, syncedAt: Date.now(), playedAt: now.playedAt });
      } else if (d === 'nothing' && cloud) {
        this.setRecord(slot, { ...rec, syncedAt: Date.now() });
      }
      this.hooks.status(`Synced · ${this.user}`, 'ok');
      return d;
    } catch (e) {
      // Someone else saved between our read and our write: look again (once) with the new cloud copy.
      if (e instanceof ConflictError && retry) return this.syncNow(slot, false);
      // Say what actually went wrong (a dropped connection reads "Failed to fetch"), so problems can be diagnosed.
      const why = e instanceof ConflictError ? 'conflict' : String((e as Error)?.message ?? e).slice(0, 120);
      this.hooks.status(/fetch|network/i.test(why) ? 'Offline, will retry' : `Sync failed: ${why}`, 'error');
      return 'error';
    }
  }
}
