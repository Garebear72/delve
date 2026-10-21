// Notifications: a queue showing a couple at a time, plus the 🔔 log of the last 50 (kept per device, not in the save).
// Epic/sticky ones wait for a tap; the rest fade. Repeats of a waiting or showing notification just bump its "×N".
export type Kind = 'info' | 'good' | 'bad' | 'epic';
export interface LogEntry { t: number; text: string; kind: Kind; n: number; read?: boolean }
interface Card { text: string; kind: Kind; n: number; sticky: boolean; entries: LogEntry[]; at: number; el?: HTMLElement; timer?: number }

const MAX_SHOWN = 2;
const FADE_MS = 4500;
const STALE_MS = 20000; // a minor one waiting this long behind sticky ones is skipped (it's still in the log)
const LOG_MAX = 50;
const KEY = 'delve.notifs';

export const log: LogEntry[] = load();
const shown: Card[] = [];
const queue: Card[] = [];
let changed = () => {};
/** Called whenever the log or its unread count changes (the UI redraws the bell and the open log). */
export function onLogChange(fn: () => void) { changed = fn; }

function load(): LogEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((e) => e && typeof e.text === 'string').slice(0, LOG_MAX) : [];
  } catch { return []; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(log)); } catch { /* ignore */ }
  changed();
}

export const unread = () => log.reduce((n, e) => n + (e.read ? 0 : 1), 0);
export function markAllRead() {
  if (!log.some((e) => !e.read)) return;
  for (const e of log) e.read = true;
  save();
}
export function clearLog() { log.length = 0; save(); }

/** Show a notification. `log: false` is for instant feedback to a tap ("Not enough stone") that isn't worth keeping. */
export function notify(text: string, kind: Kind = 'info', opts: { sticky?: boolean; log?: boolean } = {}) {
  let entry: LogEntry | null = null;
  if (opts.log !== false) {
    const last = log[0];
    if (last && last.text === text && Date.now() - last.t < 60_000) { last.n++; last.t = Date.now(); entry = last; }
    else { entry = { t: Date.now(), text, kind, n: 1 }; log.unshift(entry); log.length = Math.min(log.length, LOG_MAX); }
    entry.read = false;
    save();
  }
  const same = shown.find((c) => c.text === text) ?? queue.find((c) => c.text === text);
  if (same) {
    same.n++;
    if (entry && !same.entries.includes(entry)) same.entries.push(entry);
    if (same.el) { paint(same); if (!same.sticky) fadeLater(same); }
    paintMore();
    return;
  }
  queue.push({ text, kind, n: 1, sticky: !!opts.sticky || kind === 'epic', entries: entry ? [entry] : [], at: Date.now() });
  pump();
}

const box = () => document.getElementById('toasts');

function pump() {
  const now = Date.now();
  for (let i = queue.length - 1; i >= 0; i--) if (!queue[i].sticky && now - queue[i].at > STALE_MS) queue.splice(i, 1);
  while (shown.length < MAX_SHOWN && queue.length) show(queue.shift()!);
  paintMore();
}

function show(c: Card) {
  const b = box();
  if (!b) return;
  c.el = document.createElement('div');
  c.el.className = `toast ${c.kind}${c.sticky ? ' sticky' : ''}`;
  c.el.addEventListener('click', () => dismiss(c, true));
  paint(c);
  b.insertBefore(c.el, document.getElementById('toastMore'));
  shown.push(c);
  if (!c.sticky) fadeLater(c);
}

function paint(c: Card) {
  if (!c.el) return;
  c.el.textContent = c.text;
  if (c.n > 1) { const x = document.createElement('b'); x.className = 'times'; x.textContent = ` ×${c.n}`; c.el.appendChild(x); }
  if (c.sticky) { const x = document.createElement('span'); x.className = 'tapx'; x.textContent = '✕'; c.el.appendChild(x); }
}

function fadeLater(c: Card) {
  clearTimeout(c.timer);
  c.timer = window.setTimeout(() => dismiss(c, !document.hidden), FADE_MS);
}

/** `seen`: the player tapped it, or it sat on screen for its full time while the app was visible. */
function dismiss(c: Card, seen: boolean) {
  const i = shown.indexOf(c);
  if (i < 0) return;
  shown.splice(i, 1);
  clearTimeout(c.timer);
  if (seen && c.entries.some((e) => !e.read)) { for (const e of c.entries) e.read = true; save(); }
  const el = c.el!;
  el.classList.add('out');
  setTimeout(() => el.remove(), 350);
  pump();
}

/** "+N more" under the cards; tapping it clears everything on screen (it all stays in the 🔔 log). */
function paintMore() {
  const b = box();
  if (!b) return;
  let m = document.getElementById('toastMore');
  if (!m) {
    m = document.createElement('div');
    m.id = 'toastMore';
    m.addEventListener('click', () => { queue.length = 0; for (const c of [...shown]) dismiss(c, false); });
    b.appendChild(m);
  }
  const waiting = queue.reduce((n, c) => n + c.n, 0);
  m.textContent = waiting ? `+${waiting} more · tap to clear` : '';
  m.classList.toggle('show', waiting > 0);
}

// ---------------------------------------------------------------- the 🔔 log
const esc = (t: string) => t.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
function ago(t: number) {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function bellChip() {
  const n = unread();
  return `<button class="chip bell" data-act="notifs" title="Notifications">🔔${n ? `<span class="badge">${n > 9 ? '9+' : n}</span>` : ''}</button>`;
}

export function logModal() {
  const rows = log.map((e) => `<div class="logrow ${e.kind}${e.read ? '' : ' new'}">
    <div>${esc(e.text)}${e.n > 1 ? ` <b class="times">×${e.n}</b>` : ''}</div><div class="sub">${ago(e.t)}</div></div>`).join('');
  return `<h2>🔔 Notifications</h2>
    ${rows ? `<div class="loglist">${rows}</div>` : '<p class="sub">Nothing yet. Achievements, level-ups and discoveries will be listed here.</p>'}
    <div class="center">${rows ? '<button class="btn" data-act="notifsClear">Clear</button> ' : ''}<button class="btn epic" data-act="closeModal">Close</button></div>`;
}
