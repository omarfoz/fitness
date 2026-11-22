-- Owner decision (23 Nov 2026): show the team total from the first
-- participant, no 3-person minimum. Still aggregate only: no per-user rows.
create or replace function public.challenge_team_summary(p_challenge_id text)
returns table (participants integer, total_steps bigint)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_start date;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_challenge_id !~ '^20[2-9][0-9]-(0[1-9]|1[0-2])$' then
    raise exception 'invalid challenge id';
  end if;
  v_start := to_date(p_challenge_id || '-01', 'YYYY-MM-DD');

  select count(*)::integer into participants
  from public.challenge_participants cp
  where cp.challenge_id = p_challenge_id;

  select coalesce(sum(e.steps), 0)::bigint into total_steps
  from public.daily_entries e
  join public.challenge_participants cp
    on cp.user_id = e.user_id and cp.challenge_id = p_challenge_id
  where e.entry_date >= v_start
    and e.entry_date < (v_start + interval '1 month')::date;
  return next;
end;
$$;

revoke all on function public.challenge_team_summary(text) from public, anon;
grant execute on function public.challenge_team_summary(text) to authenticated;
