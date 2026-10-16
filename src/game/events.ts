// Tiny event bus between the simulation and the UI/renderers.
type Handler = (payload?: any) => void;
const handlers: Record<string, Handler[]> = {};

export function on(evt: string, fn: Handler) { (handlers[evt] ??= []).push(fn); }

/** When true (offline catch-up), cosmetic events are dropped. */
export let quiet = false;
export function setQuiet(q: boolean) { quiet = q; }

export function emit(evt: string, payload?: any) {
  if (quiet && evt !== 'achievement') return;
  for (const fn of handlers[evt] ?? []) fn(payload);
}
export const toast = (text: string, kind: 'info' | 'good' | 'bad' | 'epic' = 'info') => emit('toast', { text, kind });
