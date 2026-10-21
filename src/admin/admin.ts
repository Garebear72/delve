// Visitor log (admin.html): the owner signs in with their cloud-save account and browses public.visits.
// Row-level security (supabase/visits.sql) is what keeps everyone else out; this page just shows the rows.
// Dev only: `admin.html?fake` shows made-up rows without signing in.
import './admin.css';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { toEmail } from '../cloud/backend';
import { cloudConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from '../cloud/config';

interface Visit {
  id: string; started_at: string; last_seen: string; duration_s: number;
  ip: string | null; country: string | null; country_code: string | null; region: string | null; city: string | null;
  isp: string | null; lat: number | null; lon: number | null; user_agent: string | null; screen: string | null;
  lang: string | null; timezone: string | null; referrer: string | null; installed: boolean | null;
  username: string | null; version: string | null;
}
interface Row extends Visit { t: number; device: string; os: string; browser: string; bot: boolean; place: string; text: string }

type Key = 't' | 'duration_s' | 'ip' | 'place' | 'isp' | 'device' | 'browser' | 'os' | 'username' | 'visits';
const app = document.getElementById('app')!;
const fake = import.meta.env.DEV && location.search.includes('fake');
const client: SupabaseClient | null = cloudConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'delve.auth' } })
  : null;

let rows: Row[] = [];
let shown = 200;
let open = '';
const f = { q: '', from: '', to: '', country: '', device: '', bots: false, byIp: false };
let sort: { key: Key; dir: 1 | -1 } = { key: 't', dir: -1 };

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const dur = (s: number) => s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${Math.floor(s / 3600)}h ${Math.floor(s / 60) % 60}m`;
const when = (t: number) => new Date(t).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const flag = (cc: string | null) => cc && /^[A-Z]{2}$/i.test(cc) ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '🌐';

/** Device, OS and browser from the user-agent string. Rough, but good enough to tell phones from PCs. */
function parseUa(ua: string) {
  const bot = /bot|crawl|spider|slurp|headless|lighthouse|preview|curl|python|wget/i.test(ua);
  const os = /Android ([\d.]+)/.exec(ua)?.[0].replace(/(\d+)\..*/, '$1')
    ?? (/iPhone|iPad|iPod/.test(ua) ? `iOS ${/OS (\d+)/.exec(ua)?.[1] ?? ''}`.trim() : null)
    ?? (/Windows/.test(ua) ? 'Windows' : /CrOS/.test(ua) ? 'ChromeOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Other');
  const browser = /SamsungBrowser\/(\d+)/.test(ua) ? 'Samsung Internet' : /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Firefox\/|FxiOS/.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Other';
  const device = bot ? 'Bot' : /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? 'Tablet' : /Mobile|iPhone|Android/.test(ua) ? 'Phone' : 'PC';
  return { device, os, browser, bot };
}

function toRow(v: Visit): Row {
  const p = parseUa(v.user_agent ?? '');
  const place = [v.city, v.region, v.country].filter(Boolean).join(', ') || 'Unknown';
  const r = { ...v, ...p, t: Date.parse(v.started_at), place } as Row;
  r.text = [v.ip, place, v.isp, p.device, p.os, p.browser, v.username, v.referrer, v.lang, v.timezone, v.screen, v.user_agent].join(' ').toLowerCase();
  return r;
}

// ---- Data -------------------------------------------------------------------------------------------

async function loadAll(): Promise<Visit[]> {
  if (fake) return fakeRows();
  const out: Visit[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client!.from('visits').select('*').order('started_at', { ascending: false }).range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data as Visit[]));
    if (!data || data.length < 1000) return out;
  }
}

function fakeRows(): Visit[] {
  const places = [['US', 'United States', 'Texas', 'Austin'], ['US', 'United States', 'Ohio', 'Columbus'], ['GB', 'United Kingdom', 'England', 'Leeds'],
    ['DE', 'Germany', 'Bavaria', 'Munich'], ['BR', 'Brazil', 'São Paulo', 'São Paulo'], ['JP', 'Japan', 'Tokyo', 'Tokyo'], ['CA', 'Canada', 'Ontario', 'Toronto']];
  const uas = ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7; rv:131.0) Gecko/20100101 Firefox/131.0',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'];
  return Array.from({ length: 640 }, (_, i) => {
    const p = places[i % 7 === 0 ? 0 : (i * 7919) % places.length];
    const t = Date.now() - i * 3.7e6 * (1 + (i % 3));
    return {
      id: crypto.randomUUID(), started_at: new Date(t).toISOString(), last_seen: new Date(t + 6e4).toISOString(), duration_s: (i * 937) % 5400,
      ip: `${23 + (i % 40)}.${(i * 13) % 255}.${(i * 7) % 255}.${i % 255}`, country_code: p[0], country: p[1], region: p[2], city: p[3],
      isp: ['Comcast', 'BT', 'Vodafone', 'Spectrum'][i % 4], lat: 30 + (i % 20), lon: -97 + (i % 50), user_agent: uas[i % uas.length],
      screen: i % 2 ? '412×915' : '1920×1080', lang: 'en-US', timezone: 'America/Chicago', referrer: i % 5 ? '' : 'https://www.reddit.com/',
      installed: i % 3 === 0, username: i % 9 === 0 ? 'garebear' : null, version: '0.4.0',
    };
  });
}

// ---- Views ------------------------------------------------------------------------------------------

function loginView(msg = '') {
  app.innerHTML = `<form class="login" id="login">
    <h1>📊 Delve visitor log</h1>
    <div class="sub">Sign in with the game's admin cloud-save account.</div>
    ${msg ? `<div class="warn">${esc(msg)}</div>` : ''}
    <input id="u" autocomplete="username" placeholder="Username" required>
    <input id="p" type="password" autocomplete="current-password" placeholder="Password" required>
    <button class="epic" type="submit">Sign in</button>
  </form>`;
  document.getElementById('login')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = (document.getElementById('u') as HTMLInputElement).value.trim();
    const p = (document.getElementById('p') as HTMLInputElement).value;
    const { error } = await client!.auth.signInWithPassword({ email: toEmail(u), password: p });
    if (error) return loginView(/invalid/i.test(error.message) ? 'Wrong username or password.' : error.message);
    start();
  });
}

function shell(user: string) {
  app.innerHTML = `
    <div class="top">
      <div><h1>📊 Delve visitor log</h1><div class="sub" id="status">Loading…</div></div>
      <div class="row">
        <span class="sub">Signed in as ${esc(user)}</span>
        <button id="reload">↻ Refresh</button>
        <button id="csv">⬇ CSV</button>
        ${fake ? '' : '<button id="logout">Log out</button>'}
      </div>
    </div>
    <div class="cards" id="cards"></div>
    <div class="filters">
      <input type="search" id="q" placeholder="Search IP, city, ISP, device, account…">
      <label>From <input type="date" id="from"></label>
      <label>To <input type="date" id="to"></label>
      <select id="device"><option value="">All devices</option><option>Phone</option><option>Tablet</option><option>PC</option><option>Bot</option></select>
      <label><input type="checkbox" id="bots"> Show bots</label>
      <button id="byIp">Group by IP</button>
      <button id="clear">Clear filters</button>
    </div>
    <div class="chips" id="countries"></div>
    <div id="table"></div>`;
  const bind = (id: string, key: 'q' | 'from' | 'to' | 'device', ev = 'input') =>
    document.getElementById(id)!.addEventListener(ev, (e) => { f[key] = (e.target as HTMLInputElement).value; shown = 200; draw(); });
  bind('q', 'q'); bind('from', 'from', 'change'); bind('to', 'to', 'change'); bind('device', 'device', 'change');
  document.getElementById('bots')!.addEventListener('change', (e) => { f.bots = (e.target as HTMLInputElement).checked; draw(); });
  document.getElementById('byIp')!.addEventListener('click', () => { f.byIp = !f.byIp; sort = { key: f.byIp ? 'visits' : 't', dir: -1 }; draw(); });
  document.getElementById('clear')!.addEventListener('click', () => {
    Object.assign(f, { q: '', from: '', to: '', country: '', device: '', bots: false });
    for (const id of ['q', 'from', 'to', 'device']) (document.getElementById(id) as HTMLInputElement).value = '';
    (document.getElementById('bots') as HTMLInputElement).checked = false;
    draw();
  });
  document.getElementById('reload')!.addEventListener('click', () => refreshData());
  document.getElementById('csv')!.addEventListener('click', downloadCsv);
  document.getElementById('logout')?.addEventListener('click', async () => { await client!.auth.signOut(); loginView(); });
}

function setQuery(q: string) {
  f.q = q; (document.getElementById('q') as HTMLInputElement).value = q; shown = 200; draw();
}

function onClick(e: MouseEvent) {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-sort],[data-country],[data-ip],[data-row],[data-more]');
  if (!el) return;
  if (el.dataset.sort) {
    const key = el.dataset.sort as Key;
    sort = sort.key === key ? { key, dir: sort.dir === 1 ? -1 : 1 } : { key, dir: key === 't' || key === 'duration_s' || key === 'visits' ? -1 : 1 };
  } else if (el.dataset.country !== undefined) {
    f.country = f.country === el.dataset.country ? '' : el.dataset.country;
  } else if (el.dataset.ip) {
    e.stopPropagation();
    if (f.byIp) f.byIp = false;
    return setQuery(el.dataset.ip);
  } else if (el.dataset.row) {
    if ((e.target as HTMLElement).closest('tr.detail')) return;
    open = open === el.dataset.row ? '' : el.dataset.row;
  } else if (el.dataset.more) {
    shown += 500;
  }
  draw();
}

function filtered() {
  const q = f.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const from = f.from ? Date.parse(f.from + 'T00:00') : -Infinity;
  const to = f.to ? Date.parse(f.to + 'T00:00') + 864e5 : Infinity;
  return rows.filter((r) => (f.bots || !r.bot || f.device === 'Bot') && r.t >= from && r.t < to
    && (!f.country || (r.country ?? 'Unknown') === f.country) && (!f.device || r.device === f.device)
    && q.every((w) => r.text.includes(w)));
}

interface IpGroup { ip: string; visits: number; duration_s: number; t: number; first: number; place: string; country_code: string | null; isp: string; device: string; username: string }
function groupByIp(list: Row[]): IpGroup[] {
  const m = new Map<string, IpGroup>();
  for (const r of list) {
    const k = r.ip ?? '?';
    const g = m.get(k) ?? { ip: k, visits: 0, duration_s: 0, t: 0, first: Infinity, place: r.place, country_code: r.country_code, isp: r.isp ?? '', device: '', username: '' };
    g.visits++; g.duration_s += r.duration_s; g.t = Math.max(g.t, r.t); g.first = Math.min(g.first, r.t);
    if (!g.device.includes(r.device)) g.device = g.device ? `${g.device}, ${r.device}` : r.device;
    if (r.username && !g.username.includes(r.username)) g.username = g.username ? `${g.username}, ${r.username}` : r.username;
    m.set(k, g);
  }
  return [...m.values()];
}

function sorted<T extends Record<string, any>>(list: T[]) {
  const { key, dir } = sort;
  return list.sort((a, b) => {
    const x = a[key] ?? '', y = b[key] ?? '';
    return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * dir;
  });
}

function draw() {
  const list = filtered();
  const ips = new Set(list.map((r) => r.ip));
  const total = list.reduce((a, r) => a + r.duration_s, 0);
  const today = list.filter((r) => r.t >= new Date().setHours(0, 0, 0, 0)).length;
  const liveNow = list.filter((r) => Date.now() - Date.parse(r.last_seen) < 180_000).length;
  document.getElementById('cards')!.innerHTML = [
    ['Visits', list.length], ['Unique IPs', ips.size], ['Today', today], ['On now', liveNow],
    ['Countries', new Set(list.map((r) => r.country)).size], ['Avg time', dur(Math.round(total / (list.length || 1)))], ['Total time', dur(total)],
  ].map(([k, v]) => `<div class="card"><b>${v}</b><span class="sub">${k}</span></div>`).join('');

  // Country chips count everything except the country filter itself, so you can switch between them.
  const byCountry = new Map<string, { n: number; cc: string | null }>();
  for (const r of rows) {
    if (!f.bots && r.bot) continue;
    const c = r.country ?? 'Unknown';
    const e = byCountry.get(c) ?? { n: 0, cc: r.country_code };
    e.n++; byCountry.set(c, e);
  }
  document.getElementById('countries')!.innerHTML = [...byCountry].sort((a, b) => b[1].n - a[1].n)
    .map(([c, e]) => `<span class="chip ${f.country === c ? 'on' : ''}" data-country="${esc(c)}">${flag(e.cc)} ${esc(c)} · ${e.n}</span>`).join('');
  document.getElementById('byIp')!.className = f.byIp ? 'on' : '';

  const th = (key: Key, label: string) => `<th data-sort="${key}" class="${sort.key === key ? 'sorted' : ''}">${label}${sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</th>`;
  let html: string;
  let count: number;
  if (f.byIp) {
    const groups = sorted(groupByIp(list));
    count = groups.length;
    html = `<table><thead><tr>${th('ip', 'IP')}${th('visits', 'Visits')}${th('duration_s', 'Total time')}${th('t', 'Last visit')}${th('place', 'Location')}${th('isp', 'ISP')}${th('device', 'Devices')}${th('username', 'Account')}</tr></thead><tbody>
      ${groups.slice(0, shown).map((g) => `<tr><td><span class="ip" data-ip="${esc(g.ip)}">${esc(g.ip)}</span></td><td>${g.visits}</td><td>${dur(g.duration_s)}</td>
        <td>${when(g.t)}</td><td>${flag(g.country_code)} ${esc(g.place)}</td><td>${esc(g.isp)}</td><td>${esc(g.device)}</td><td>${esc(g.username)}</td></tr>`).join('')}
      </tbody></table>`;
  } else {
    const vs = sorted(list);
    count = vs.length;
    html = `<table><thead><tr>${th('t', 'When')}${th('duration_s', 'Time on site')}${th('ip', 'IP')}${th('place', 'Location')}${th('isp', 'ISP')}${th('device', 'Device')}${th('os', 'OS')}${th('browser', 'Browser')}${th('username', 'Account')}</tr></thead><tbody>
      ${vs.slice(0, shown).map((r) => {
        const live = Date.now() - Date.parse(r.last_seen) < 180_000 ? ' <span class="live">● on now</span>' : '';
        const row = `<tr data-row="${r.id}"><td>${when(r.t)}${live}</td><td>${dur(r.duration_s)}</td><td><span class="ip" data-ip="${esc(r.ip)}">${esc(r.ip ?? '?')}</span></td>
          <td>${flag(r.country_code)} ${esc(r.place)}</td><td>${esc(r.isp)}</td><td>${r.device}${r.bot ? ' <span class="bot">bot</span>' : ''}${r.installed ? ' 📲' : ''}</td><td>${esc(r.os)}</td><td>${esc(r.browser)}</td><td>${esc(r.username)}</td></tr>`;
        return open === r.id ? row + detail(r) : row;
      }).join('')}
      </tbody></table>`;
  }
  const more = count > shown ? `<button class="more" data-more="1">Show more (${count - shown} left)</button>` : '';
  document.getElementById('table')!.innerHTML = count ? `<div class="tablewrap">${html}</div>${more}` : '<p class="sub">No visits match these filters.</p>';
}

function detail(r: Row) {
  const map = r.lat != null && r.lon != null ? ` · <a href="https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lon}#map=10/${r.lat}/${r.lon}" target="_blank" rel="noopener">map</a>` : '';
  const items: [string, string][] = [
    ['Started', new Date(r.t).toLocaleString()], ['Last seen', new Date(r.last_seen).toLocaleString()],
    ['Location', `${r.place}${r.lat != null ? ` (${r.lat}, ${r.lon})` : ''}`], ['Screen', r.screen ?? ''], ['Language', r.lang ?? ''], ['Time zone', r.timezone ?? ''],
    ['Opened as', r.installed ? 'Installed app' : 'Browser tab'], ['Came from', r.referrer || '(direct)'], ['Game version', r.version ?? ''],
    ['User agent', r.user_agent ?? ''], ['Visit id', r.id],
  ];
  return `<tr class="detail"><td colspan="9"><dl>${items.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}${k === 'Location' ? map : ''}</dd>`).join('')}</dl></td></tr>`;
}

function downloadCsv() {
  const cols: (keyof Row)[] = ['started_at', 'duration_s', 'ip', 'country', 'region', 'city', 'isp', 'device', 'os', 'browser', 'username', 'screen', 'lang', 'timezone', 'referrer', 'installed', 'user_agent'];
  const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...sorted(filtered()).map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `delve-visits-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

async function refreshData() {
  const status = document.getElementById('status')!;
  status.textContent = 'Loading…';
  try {
    rows = (await loadAll()).map(toRow);
    status.textContent = rows.length ? `${rows.length} visits recorded · updated ${new Date().toLocaleTimeString()}`
      : 'No visits yet (or this account isn\'t the admin, so the database shows it nothing).';
  } catch (e) {
    status.innerHTML = `<span class="warn">Couldn't load visits: ${esc((e as Error).message)}</span>`;
  }
  draw();
}

async function start() {
  if (fake) { shell('(sample data)'); return refreshData(); }
  if (!client) { app.innerHTML = '<p>Cloud saves aren\'t configured for this copy of the game.</p>'; return; }
  const { data } = await client.auth.getSession();
  const email = data.session?.user.email;
  if (!email) return loginView();
  shell(email.split('@')[0]);
  refreshData();
}
app.addEventListener('click', onClick);
start();
