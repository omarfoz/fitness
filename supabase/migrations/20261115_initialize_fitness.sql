-- Fitness Tracker: schema already deployed to the linked Supabase project on 2026-11-15.
-- This is a source-controlled copy for reproducibility.
create table if not exists public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  steps integer check (steps between 0 and 100000),
  calories_estimate integer check (calories_estimate between 0 and 15000),
  meals text check (char_length(meals) <= 3000),
  fasting_hours numeric(4,1) check (fasting_hours between 0 and 24),
  one_meal boolean not null default false,
  coffee_cups integer not null default 0 check (coffee_cups between 0 and 30),
  waist_cm numeric(5,1) check (waist_cm between 30 and 300),
  notes text check (char_length(notes) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);
create index if not exists daily_entries_user_date_idx on public.daily_entries (user_id, entry_date desc);
create table if not exists public.weekly_flex (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  flex_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, week_start),
  constraint flex_within_week check (flex_date >= week_start and flex_date < week_start + 7),
  constraint flex_not_friday check (extract(isodow from flex_date) <> 5),
  constraint week_starts_sunday check (extract(dow from week_start) = 0)
);
create index if not exists weekly_flex_user_week_idx on public.weekly_flex (user_id, week_start);
create or replace function public.set_fitness_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists daily_entries_set_updated_at on public.daily_entries;
create trigger daily_entries_set_updated_at before update on public.daily_entries
  for each row execute function public.set_fitness_updated_at();
alter table public.daily_entries enable row level security;
alter table public.weekly_flex enable row level security;
revoke all on public.daily_entries from anon;
revoke all on public.weekly_flex from anon;
grant select, insert, update, delete on public.daily_entries to authenticated;
grant select, insert, update, delete on public.weekly_flex to authenticated;
create policy "read own daily entries" on public.daily_entries
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own daily entries" on public.daily_entries
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own daily entries" on public.daily_entries
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "delete own daily entries" on public.daily_entries
  for delete to authenticated using ((select auth.uid()) = user_id);
create policy "read own flex" on public.weekly_flex
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own flex" on public.weekly_flex
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own flex" on public.weekly_flex
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "delete own flex" on public.weekly_flex
  for delete to authenticated using ((select auth.uid()) = user_id);
