-- Reproducible Web Push setup for a fresh Supabase project.
-- The live fitness project already has these schema changes and cron jobs applied.
-- Create TWO secrets separately via Supabase Vault (never commit their values):
--   fitness_push_vapid_private : VAPID private key, base64url-encoded
--   fitness_push_cron_token   : random secret string
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table public.fitness_push_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  reminder_times text[] not null default array['10:00','16:00','21:00']::text[],
  updated_at timestamptz not null default now(),
  constraint fitness_push_times_valid check (
    cardinality(reminder_times) between 0 and 3
    and reminder_times <@ array['10:00','16:00','21:00']::text[]
  )
);
create table public.fitness_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fitness_push_endpoint_valid check (
    endpoint like 'https://%' and char_length(endpoint) between 25 and 2000
    and char_length(p256dh) between 20 and 250
    and char_length(auth_secret) between 10 and 250
  ),
  constraint fitness_push_trusted_endpoint check (
    endpoint ~ '^https://([a-zA-Z0-9-]+[.])*push[.]apple[.]com/'
    or endpoint ~ '^https://fcm[.]googleapis[.]com/'
    or endpoint ~ '^https://android[.]googleapis[.]com/gcm/send/'
    or endpoint ~ '^https://updates[.]push[.]services[.]mozilla[.]com/'
    or endpoint ~ '^https://([a-zA-Z0-9-]+[.])*notify[.]windows[.]com/'
    or endpoint ~ '^https://([a-zA-Z0-9-]+[.])*push[.]samsungosp[.]com/'
  ));
create index fitness_push_subscriptions_by_owner on public.fitness_push_subscriptions(user_id);
create table public.fitness_push_delivery_runs (
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_date date not null,
  reminder_time text not null,
  sent_at timestamptz not null default now(),
  delivered_at timestamptz,
  primary key (user_id, reminder_date, reminder_time)
);
alter table public.fitness_push_preferences enable row level security;
alter table public.fitness_push_subscriptions enable row level security;
alter table public.fitness_push_delivery_runs enable row level security;
create policy fitness_push_preferences_read on public.fitness_push_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy fitness_push_preferences_insert on public.fitness_push_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy fitness_push_preferences_update on public.fitness_push_preferences
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy fitness_push_preferences_delete on public.fitness_push_preferences
  for delete to authenticated using (user_id = (select auth.uid()));
create policy fitness_push_subscriptions_read on public.fitness_push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy fitness_push_subscriptions_insert on public.fitness_push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy fitness_push_subscriptions_update on public.fitness_push_subscriptions
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy fitness_push_subscriptions_delete on public.fitness_push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.fitness_push_preferences from public, anon;
revoke all on public.fitness_push_subscriptions from public, anon;
revoke all on public.fitness_push_delivery_runs from public, anon, authenticated;
grant select, insert, update, delete on public.fitness_push_preferences to authenticated;
grant select, insert, update, delete on public.fitness_push_subscriptions to authenticated;

create or replace function public.fitness_push_sender_secrets()
returns table (vapid_private_key text, cron_token text)
language sql security definer set search_path = ''
as $fn$
  select
    (select decrypted_secret from vault.decrypted_secrets where name = 'fitness_push_vapid_private' limit 1),
    (select decrypted_secret from vault.decrypted_secrets where name = 'fitness_push_cron_token' limit 1);
$fn$;
revoke all on function public.fitness_push_sender_secrets() from public, anon, authenticated;
grant execute on function public.fitness_push_sender_secrets() to service_role;

-- Supabase Cron uses UTC. Asia/Riyadh is UTC+3 year-round.
-- Replace PROJECT_REF with your own Supabase project ref when setting up a different project.
select cron.schedule('fitness-morning-ksa', '0,5 7 * * *', $job$
  select net.http_post(
    url := 'https://PROJECT_REF.supabase.co/functions/v1/fitness-push-send',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-fitness-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'fitness_push_cron_token' limit 1)
    ),
    body := jsonb_build_object('slot','10:00'),
    timeout_milliseconds := 30000
  );
$job$);
select cron.schedule('fitness-afternoon-ksa', '0,5 13 * * *', $job$
  select net.http_post(
    url := 'https://PROJECT_REF.supabase.co/functions/v1/fitness-push-send',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-fitness-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'fitness_push_cron_token' limit 1)
    ),
    body := jsonb_build_object('slot','16:00'),
    timeout_milliseconds := 30000
  );
$job$);
select cron.schedule('fitness-evening-ksa', '0,5 18 * * *', $job$
  select net.http_post(
    url := 'https://PROJECT_REF.supabase.co/functions/v1/fitness-push-send',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-fitness-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'fitness_push_cron_token' limit 1)
    ),
    body := jsonb_build_object('slot','21:00'),
    timeout_milliseconds := 30000
  );
$job$);
