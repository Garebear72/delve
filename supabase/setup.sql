-- Delve cloud saves. Paste this whole file into Supabase → SQL Editor → New query → Run.
-- One row per (player, save slot). Row-level security means each player can only touch their own rows.

create table if not exists public.saves (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  slot int not null check (slot between 1 and 5),
  rev int not null default 1,
  data text not null,
  saved_at bigint not null,          -- the game's own timestamp (ms)
  device text,
  summary text,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot)
);

alter table public.saves enable row level security;

-- Signed-in players may use the table (row-level security below still limits them to their own rows).
-- Needed when the project doesn't auto-expose new tables to the Data API (Supabase's recommended setting).
grant select, insert, update on public.saves to authenticated;

drop policy if exists "players read own saves" on public.saves;
create policy "players read own saves" on public.saves for select using (auth.uid() = user_id);
drop policy if exists "players write own saves" on public.saves;
create policy "players write own saves" on public.saves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Store a save only if the cloud copy is still at the revision the device last saw.
-- Two devices can never silently overwrite each other: a stale upload fails with 'conflict'.
create or replace function public.put_save(
  p_slot int, p_data text, p_expected int, p_device text, p_summary text, p_saved_at bigint
) returns int
language plpgsql security invoker set search_path = public as $$
declare cur int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if length(p_data) > 2000000 then raise exception 'save too large'; end if;
  select rev into cur from public.saves where user_id = auth.uid() and slot = p_slot for update;
  if cur is null then
    if p_expected <> 0 then raise exception 'conflict'; end if;
    insert into public.saves (user_id, slot, rev, data, saved_at, device, summary)
      values (auth.uid(), p_slot, 1, p_data, p_saved_at, p_device, p_summary);
    return 1;
  end if;
  if cur <> p_expected then raise exception 'conflict'; end if;
  update public.saves
    set rev = cur + 1, data = p_data, saved_at = p_saved_at, device = p_device, summary = p_summary, updated_at = now()
    where user_id = auth.uid() and slot = p_slot;
  return cur + 1;
end $$;

grant execute on function public.put_save(int, text, int, text, text, bigint) to authenticated;
