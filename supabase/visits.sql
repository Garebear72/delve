create table if not exists public.visits (
  id uuid primary key,                 
  started_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  duration_s int not null default 0,   
  ip text,
  country text,
  country_code text,
  region text,
  city text,
  isp text,
  lat double precision,
  lon double precision,
  user_agent text,                     
  screen text,
  lang text,
  timezone text,
  referrer text,
  installed boolean,                   
  username text,                       -- cloud-save account, if signed in
  version text
);
create index if not exists visits_started on public.visits (started_at desc);
create index if not exists visits_ip on public.visits (ip);

alter table public.visits enable row level security;

-- admin 
create or replace function public.is_delve_admin() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'garebear@players.garebear72.github.io'
$$;

-- Only the admin may read visits. Nobody may write through the public API
grant select on public.visits to authenticated;
grant all on public.visits to service_role;
drop policy if exists "admin reads visits" on public.visits;
create policy "admin reads visits" on public.visits for select to authenticated using (public.is_delve_admin());

-- Heartbeat from the Edge Function: update how long a visit lasted. 
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
