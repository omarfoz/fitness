-- Monthly challenges: "everyone wins".
-- 1) challenge_participants: one row per (challenge month, user). Users can
--    only see, add and remove their own rows.
-- 2) challenge_team_summary(month): SECURITY DEFINER aggregate for the team
--    bar. Returns the participant count always, but the step total only when
--    at least 3 people have joined, so nobody can read one colleague's steps
--    back out of the total. No per-user rows ever leave the function.
-- Challenge ids are months ('YYYY-MM'); the month's dates come from the id,
-- so callers cannot ask for arbitrary date ranges.

create table if not exists public.challenge_participants (
  challenge_id text not null check (challenge_id ~ '^20[2-9][0-9]-(0[1-9]|1[0-2])$'),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

alter table public.challenge_participants enable row level security;
revoke all on public.challenge_participants from anon;

drop policy if exists "read own challenge joins" on public.challenge_participants;
create policy "read own challenge joins" on public.challenge_participants
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "join a challenge" on public.challenge_participants;
create policy "join a challenge" on public.challenge_participants
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "leave a challenge" on public.challenge_participants;
create policy "leave a challenge" on public.challenge_participants
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.challenge_team_summary(p_challenge_id text)
returns table (participants integer, total_steps bigint)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_start date;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_challenge_id !~ '^20[2-9][0-9]-(0[1-9]|1[0-2])$' then
    raise exception 'invalid challenge id';
  end if;
  v_start := to_date(p_challenge_id || '-01', 'YYYY-MM-DD');

  select count(*)::integer into v_count
  from public.challenge_participants cp
  where cp.challenge_id = p_challenge_id;

  participants := v_count;
  if v_count >= 3 then
    select coalesce(sum(e.steps), 0)::bigint into total_steps
    from public.daily_entries e
    join public.challenge_participants cp
      on cp.user_id = e.user_id and cp.challenge_id = p_challenge_id
    where e.entry_date >= v_start
      and e.entry_date < (v_start + interval '1 month')::date;
  else
    total_steps := null;
  end if;
  return next;
end;
$$;

revoke all on function public.challenge_team_summary(text) from public, anon;
grant execute on function public.challenge_team_summary(text) to authenticated;
