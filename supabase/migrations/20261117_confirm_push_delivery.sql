-- Make 5-minute scheduled retries safe after pg_net/Edge Function timeouts.
-- A row may be reserved before the provider accepts an alert. Do not treat
-- that reservation as a completed send until delivered_at has been set.
alter table public.fitness_push_delivery_runs
  add column if not exists delivered_at timestamptz;

comment on column public.fitness_push_delivery_runs.delivered_at is
  'Timestamp when a Web Push service accepted at least one notification. NULL permits retry after interrupted dispatch.';
