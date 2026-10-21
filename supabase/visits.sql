-- Delve visitor log. Paste this whole file into Supabase → SQL Editor → New query → Run.
-- One row per visit. Rows are written only by the `visit` Edge Function (supabase/functions/visit),
-- which adds the visitor's IP address and its approximate location. Only the admin account can read them.
-- Rows are kept forever (no automatic deletion).

create table if not exists public.visits (
  id uuid primary key,                 -- random per visit, made by the browser
  started_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  duration_s int not null default 0,   -- seconds the game was on screen
  ip text,
  country text,
  country_code text,
  region text,
  city text,
  isp text,
  lat double precision,
  lon double precision,
  user_agent text,                     -- browser/device string (parsed into device/browser/OS by admin.html)
  screen text,
  lang text,
  timezone text,
  referrer text,
  installed boolean,                   -- opened as the installed app rather than in a browser tab
  username text,                       -- cloud-save account, if signed in
  version text
);
create index if not exists visits_started on public.visits (started_at desc);
create index if not exists visits_ip on public.visits (ip);

alter table public.visits enable row level security;

-- The admin is the cloud-save account "garebear" (accounts are stored as <username>@players.garebear72.github.io).
create or replace function public.is_delve_admin() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'garebear@players.garebear72.github.io'
$$;

-- Only the admin may read visits. Nobody may write through the public API: the Edge Function uses the
-- service role, which bypasses row-level security.
grant select on public.visits to authenticated;
grant all on public.visits to service_role;
drop policy if exists "admin reads visits" on public.visits;
create policy "admin reads visits" on public.visits for select to authenticated using (public.is_delve_admin());

-- Heartbeat from the Edge Function: update how long a visit lasted. The duration can't exceed the time
-- since the visit started, so a tampered heartbeat can't invent hours.
create or replace function public.visit_ping(p_id uuid, p_dur int, p_user text)
returns void language sql security invoker set search_path = public as $$
  update public.visits
    set duration_s = greatest(duration_s, least(greatest(p_dur, 0), extract(epoch from now() - started_at)::int + 10)),
        last_seen = now(),
        username = coalesce(username, nullif(left(p_user, 40), ''))
    where id = p_id;
$$;
revoke execute on function public.visit_ping(uuid, int, text) from public, anon, authenticated;
grant execute on function public.visit_ping(uuid, int, text) to service_role;
