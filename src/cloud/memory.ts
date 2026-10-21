// An in-memory Backend for tests (tools/sync-test.mjs): several "devices" can share one instance.
import { Backend, CloudSave, ConflictError } from './sync';

export class MemoryServer {
  users = new Map<string, string>();
  saves = new Map<string, CloudSave>();
  /** Called inside put() between the read and the write, to simulate another device racing. */
  onBetween: (() => void) | null = null;
}

export class MemoryBackend implements Backend {
  private user: string | null = null;
  constructor(private server: MemoryServer) {}
  async signUp(u: string, p: string) { if (this.server.users.has(u)) throw new Error('taken'); this.server.users.set(u, p); this.user = u; }
  async signIn(u: string, p: string) { if (this.server.users.get(u) !== p) throw new Error('bad login'); this.user = u; }
  async signOut() { this.user = null; }
  async changePassword(p: string) { if (this.user) this.server.users.set(this.user, p); }
  async currentUser() { return this.user; }
  async get(slot: number) { const s = this.server.saves.get(`${this.user}/${slot}`); return s ? { ...s } : null; }
  async put(slot: number, data: string, expectedRev: number, device: string, summary: string, savedAt: number) {
    const key = `${this.user}/${slot}`;
    const hook = this.server.onBetween; this.server.onBetween = null; hook?.();
    const cur = this.server.saves.get(key);
    if ((cur?.rev ?? 0) !== expectedRev) throw new ConflictError();
    const rev = (cur?.rev ?? 0) + 1;
    this.server.saves.set(key, { slot, rev, data, savedAt, device, summary });
    return rev;
  }
}
