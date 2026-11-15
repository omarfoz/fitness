-- Fitness Tracker - private sharing migration
-- Applied to Supabase on 2026-11-15. Reproducible migration source.
--
-- Security model:
-- 1) Invitations are owned by the person sharing progress.
-- 2) Only an account with a confirmed matching email can claim an invitation.
-- 3) A viewer can never update the owner's tracking records.
-- 4) SECURITY DEFINER summary RPCs return selected metrics only.
--    Meals, private notes, and waist measurements are intentionally excluded.

create table if not exists public.progress_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  viewer_email text not null,
  viewer_id uuid references auth.users(id) on delete cascade,
  display_name text not null default 'Fitness progress',
  created_at timestamptz not null default now(),
  constraint progress_shares_unique_email unique (owner_id, viewer_email),
  constraint progress_shares_valid_email check (
    viewer_email = lower(btrim(viewer_email))
    and char_length(viewer_email) between 3 and 254
    and position('@' in viewer_email) > 1
  ),
  constraint progress_shares_valid_label check (char_length(display_name) between 1 and 80),
  constraint progress_shares_not_self check (viewer_id is null or owner_id <> viewer_id)
);

create index if not exists progress_shares_viewer_id_idx
  on public.progress_shares (viewer_id, owner_id);

alter table public.progress_shares enable row level security;
revoke all on public.progress_shares from anon;
grant select, delete on public.progress_shares to authenticated;
-- Deliberately do not grant INSERT privilege on viewer_id. Only the secure
-- verification function may claim an invitation.
revoke insert on public.progress_shares from authenticated;
grant insert (owner_id, viewer_email, display_name)
  on public.progress_shares to authenticated;

drop policy if exists "owner can list invited viewers" on public.progress_shares;
create policy "owner can list invited viewers" on public.progress_shares
  for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists "claimed viewer can list invitation" on public.progress_shares;
create policy "claimed viewer can list invitation" on public.progress_shares
  for select to authenticated using ((select auth.uid()) = viewer_id);
drop policy if exists "owner can add viewer" on public.progress_shares;
create policy "owner can add viewer" on public.progress_shares
  for insert to authenticated with check ((select auth.uid()) = owner_id);
drop policy if exists "owner can revoke viewer" on public.progress_shares;
create policy "owner can revoke viewer" on public.progress_shares
  for delete to authenticated using ((select auth.uid()) = owner_id);

create or replace function public.claim_fitness_invitations()
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  verified_email text;
  affected integer := 0;
begin
  select lower(u.email) into verified_email
    from auth.users u
   where u.id = (select auth.uid())
     and u.email_confirmed_at is not null;

  if verified_email is null then
    return 0;
  end if;

  update public.progress_shares
     set viewer_id = (select auth.uid())
   where viewer_email = verified_email
     and (viewer_id is null or viewer_id = (select auth.uid()));
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function public.claim_fitness_invitations() from public, anon;
grant execute on function public.claim_fitness_invitations() to authenticated;

-- Remove any broad row-level sharing before exposing the restricted RPCs.
drop policy if exists "invited viewer can read daily entries" on public.daily_entries;
drop policy if exists "invited viewer can read weekly flex" on public.weekly_flex;

create or replace function public.shared_fitness_entries(p_owner_id uuid)
returns table (
  entry_date date,
  steps integer,
  calories_estimate integer,
  fasting_hours numeric,
  one_meal boolean,
  coffee_cups integer
)
language sql stable security definer set search_path = ''
as $$
  select d.entry_date, d.steps, d.calories_estimate,
         d.fasting_hours, d.one_meal, d.coffee_cups
    from public.daily_entries d
   where d.user_id = p_owner_id
     and exists (
       select 1 from public.progress_shares s
        where s.owner_id = p_owner_id
          and s.viewer_id = (select auth.uid())
     )
   order by d.entry_date desc
   limit 1000;
$$;
revoke all on function public.shared_fitness_entries(uuid) from public, anon;
grant execute on function public.shared_fitness_entries(uuid) to authenticated;

create or replace function public.shared_fitness_weeks(p_owner_id uuid)
returns table (week_start date, flex_date date)
language sql stable security definer set search_path = ''
as $$
  select w.week_start, w.flex_date
    from public.weekly_flex w
   where w.user_id = p_owner_id
     and exists (
       select 1 from public.progress_shares s
        where s.owner_id = p_owner_id
          and s.viewer_id = (select auth.uid())
     )
   order by w.week_start desc
   limit 250;
$$;
revoke all on function public.shared_fitness_weeks(uuid) from public, anon;
grant execute on function public.shared_fitness_weeks(uuid) to authenticated;
