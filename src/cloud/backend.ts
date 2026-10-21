// The real Backend: Supabase auth (username + password) and the `saves` table / `put_save` function.
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import { Backend, CloudSave, ConflictError } from './sync';

// Supabase accounts are keyed by email; players only ever see a username. No email is ever sent
// (email confirmation is switched off in the project), this address just has to look like one.
const EMAIL_DOMAIN = 'players.garebear72.github.io';
const toEmail = (user: string) => `${user.toLowerCase()}@${EMAIL_DOMAIN}`;
const fromEmail = (email: string | undefined) => (email ?? '').split('@')[0] || null;

/** Usernames: 3–20 letters, numbers or underscores. */
export const validUsername = (u: string) => /^[a-zA-Z0-9_]{3,20}$/.test(u);

export class SupabaseBackend implements Backend {
  private client: Promise<SupabaseClient>;
  constructor() {
    // Loaded on demand so players without an account don't download it.
    this.client = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'delve.auth' } }));
  }

  async signUp(user: string, pass: string) {
    const c = await this.client;
    const { data, error } = await c.auth.signUp({ email: toEmail(user), password: pass });
    if (error) throw new Error(/registered|exists/i.test(error.message) ? 'That username is taken.' : error.message);
    if (!data.session) throw new Error('Account created, but sign-in needs email confirmation turned off in Supabase.');
  }

  async signIn(user: string, pass: string) {
    const c = await this.client;
    const { error } = await c.auth.signInWithPassword({ email: toEmail(user), password: pass });
    if (error) throw new Error(/invalid/i.test(error.message) ? 'Wrong username or password.' : error.message);
  }

  async signOut() { const c = await this.client; await c.auth.signOut(); }

  async currentUser() {
    const c = await this.client;
    const { data } = await c.auth.getSession();
    return data.session ? fromEmail(data.session.user.email) : null;
  }

  async changePassword(pass: string) {
    const c = await this.client;
    const { error } = await c.auth.updateUser({ password: pass });
    if (error) throw new Error(error.message);
  }

  async get(slot: number): Promise<CloudSave | null> {
    const c = await this.client;
    const { data, error } = await c.from('saves').select('slot, rev, data, saved_at, device, summary').eq('slot', slot).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return { slot: data.slot, rev: data.rev, data: data.data, savedAt: Number(data.saved_at), device: data.device ?? '', summary: data.summary ?? '' };
  }

  async put(slot: number, data: string, expectedRev: number, device: string, summary: string, savedAt: number) {
    const c = await this.client;
    const { data: rev, error } = await c.rpc('put_save', {
      p_slot: slot, p_data: data, p_expected: expectedRev, p_device: device, p_summary: summary, p_saved_at: Math.round(savedAt),
    });
    if (error) throw /conflict/i.test(error.message) ? new ConflictError() : new Error(error.message);
    return rev as number;
  }
}
