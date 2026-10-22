// Visitor log: tells the `visit` Edge Function (supabase/functions/visit) when someone opens the game and,
// after 10 s, 30 s and 1 min on screen, then every 2 minutes, and on leaving, how long it has been on screen. The function adds IP and location.
// The owner reads the log on admin.html. Off in dev unless the page is opened with `?track`.
import { cloud } from '.';
import { cloudConfigured, SUPABASE_URL } from './config';

const ENDPOINT = `${SUPABASE_URL}/functions/v1/visit`;
// Heartbeats at these seconds on screen, then every 2 minutes. The early ones give short visits a time even
// when the browser drops the message sent on leaving (common on phones).
const EARLY = [10, 30, 60];
const PING_EVERY = 120;
const NEW_VISIT_AFTER = 1800_000; // hidden this long (ms) = the next return counts as a new visit

let id = '';
let shown = 0;   // seconds on screen before the current stretch
let since = 0;   // when the current on-screen stretch began (ms), 0 while hidden
let hiddenAt = 0;
let next = EARLY[0]; // seconds on screen at which the next heartbeat is due

const onScreen = () => Math.round(shown + (since ? (Date.now() - since) / 1000 : 0));

function send(body: object, beacon = false) {
  // text/plain keeps it a "simple" request: no CORS preflight, and sendBeacon accepts it.
  const data = JSON.stringify({ ...body, id, user: cloud?.user ?? '' });
  try {
    if (beacon && navigator.sendBeacon?.(ENDPOINT, new Blob([data], { type: 'text/plain' }))) return;
    fetch(ENDPOINT, { method: 'POST', body: data, headers: { 'Content-Type': 'text/plain' }, keepalive: true }).catch(() => { /* offline */ });
  } catch { /* never let the log break the game */ }
}

function begin() {
  id = crypto.randomUUID();
  shown = 0;
  since = Date.now();
  next = EARLY[0];
  send({
    t: 'start',
    screen: `${screen.width}×${screen.height}`,
    lang: navigator.language,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ref: document.referrer,
    installed: matchMedia('(display-mode: standalone)').matches,
    ver: __APP_VERSION__,
  });
}

export function startVisitLog() {
  if (!cloudConfigured() || (import.meta.env.DEV && !location.search.includes('track'))) return;
  if (!('randomUUID' in crypto)) return;
  begin();
  if (document.hidden) { shown = 0; since = 0; hiddenAt = Date.now(); }
  setInterval(() => {
    const dur = onScreen();
    if (!since || dur < next) return;
    send({ t: 'ping', dur });
    next = EARLY.find((t) => t > dur) ?? (Math.floor(dur / PING_EVERY) + 1) * PING_EVERY;
  }, 5000);
  const leave = () => {
    if (!since) return;
    shown = onScreen(); since = 0; hiddenAt = Date.now();
    send({ t: 'ping', dur: shown }, true);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return leave();
    if (since) return;
    if (Date.now() - hiddenAt > NEW_VISIT_AFTER) begin();
    else since = Date.now();
  });
  addEventListener('pagehide', leave);
}
