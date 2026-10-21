// Body:
//   { t: 'start', id, screen, lang, tz, ref, installed, user, ver }
//   { t: 'ping', id, dur, user }

const URL_ = Deno.env.get('SUPABASE_URL')!;
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || (() => {
  try { return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default ?? ''; } catch { return ''; }
})();
const headers = (extra: Record<string, string> = {}) => ({
  apikey: KEY,
  ...(KEY.startsWith('eyJ') ? { Authorization: `Bearer ${KEY}` } : {}),
  'Content-Type': 'application/json',
  ...extra,
});
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const str = (v: unknown, max = 200) => (typeof v === 'string' && v ? v.slice(0, max) : null);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clientIp(req: Request) {
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return fwd || req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || null;
}

const isPublic = (ip: string) => !/^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i.test(ip);

interface Geo { country?: string; country_code?: string; region?: string; city?: string; isp?: string; lat?: number; lon?: number }


async function geo(ip: string): Promise<Geo> {
  if (!isPublic(ip)) return {};
  try {
    const r = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,regionName,city,isp,lat,lon`, { signal: AbortSignal.timeout(3000) });
    const j = await r.json();
    if (j.status === 'success') return { country: j.country, country_code: j.countryCode, region: j.regionName, city: j.city, isp: j.isp, lat: j.lat, lon: j.lon };
  } catch { /* try the next one */ }
  try {
    const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, { signal: AbortSignal.timeout(3000) });
    const j = await r.json();
    if (j.success) return { country: j.country, country_code: j.country_code, region: j.region, city: j.city, isp: j.connection?.isp, lat: j.latitude, lon: j.longitude };
  } catch { /* no location */ }
  return {};
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return new Response('POST only', { status: 405, headers: cors });
  let b: any;
  try { b = JSON.parse((await req.text()).slice(0, 4000)); } catch { return new Response('bad json', { status: 400, headers: cors }); }
  if (!b || typeof b.id !== 'string' || !UUID.test(b.id)) return new Response('bad id', { status: 400, headers: cors });

  let res: Response;
  if (b.t === 'start') {
    const ip = clientIp(req);
    const row = {
      id: b.id,
      ip,
      ...(ip ? await geo(ip) : {}),
      user_agent: str(req.headers.get('user-agent'), 400),
      screen: str(b.screen, 20),
      lang: str(b.lang, 20),
      timezone: str(b.tz, 60),
      referrer: str(b.ref, 300),
      installed: b.installed === true,
      username: str(b.user, 40),
      version: str(b.ver, 20),
    };
    res = await fetch(`${URL_}/rest/v1/visits`, { method: 'POST', headers: headers({ Prefer: 'resolution=ignore-duplicates,return=minimal' }), body: JSON.stringify(row) });
  } else if (b.t === 'ping') {
    const dur = Math.max(0, Math.min(86400 * 7, Math.floor(Number(b.dur) || 0)));
    res = await fetch(`${URL_}/rest/v1/rpc/visit_ping`, { method: 'POST', headers: headers(), body: JSON.stringify({ p_id: b.id, p_dur: dur, p_user: str(b.user, 40) ?? '' }) });
  } else {
    return new Response('bad type', { status: 400, headers: cors });
  }
  if (!res.ok) return new Response(await res.text(), { status: 500, headers: cors });
  return new Response('ok', { headers: cors });
});
