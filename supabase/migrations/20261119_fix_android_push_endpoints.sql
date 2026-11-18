-- Correct the historic double-escaped regex that rejected Android Web Push subscriptions.
-- [.] matches a literal DNS separator without relying on SQL backslash settings.
-- Reject untrusted hosts. Only use HTTPS push-provider endpoints.
alter table public.fitness_push_subscriptions
  drop constraint if exists fitness_push_trusted_endpoint;

alter table public.fitness_push_subscriptions
  add constraint fitness_push_trusted_endpoint
  check (
    endpoint ~ '^https://([a-zA-Z0-9-]+[.])*push[.]apple[.]com/'
    or endpoint ~ '^https://fcm[.]googleapis[.]com/'
    or endpoint ~ '^https://android[.]googleapis[.]com/gcm/send/'
    or endpoint ~ '^https://updates[.]push[.]services[.]mozilla[.]com/'
    or endpoint ~ '^https://([a-zA-Z0-9-]+[.])*notify[.]windows[.]com/'
    or endpoint ~ '^https://([a-zA-Z0-9-]+[.])*push[.]samsungosp[.]com/'
  );
